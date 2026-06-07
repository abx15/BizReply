import request from 'supertest';
import { app } from '../index';
import { connectMemoryDb, closeMemoryDb, clearMemoryDb } from './setup';
import { Business } from '../models/Business';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';

describe('Billing and Subscription API Tests', () => {
  let token = '';
  let businessId = '';

  beforeAll(async () => {
    await connectMemoryDb();
  });

  afterAll(async () => {
    await closeMemoryDb();
  });

  beforeEach(async () => {
    await clearMemoryDb();
    
    // Register business for testing
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Razor Salon',
        email: 'razor@salon.com',
        phone: '917777777777',
        password: 'password123'
      });
    
    token = signupRes.body.data.token;
    businessId = signupRes.body.data.business.id;
  });

  describe('POST /api/billing/create-subscription', () => {
    it('should successfully create mock subscription for starter plan', async () => {
      const res = await request(app)
        .post('/api/billing/create-subscription')
        .set('Authorization', `Bearer ${token}`)
        .send({ plan: 'starter' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.business.plan).toBe('starter');
      expect(res.body.data.business.trialEndsAt).toBeNull();
      expect(res.body.data.business.subscriptionId).toContain('sub_mock_');
    });

    it('should successfully create mock subscription for pro plan', async () => {
      const res = await request(app)
        .post('/api/billing/create-subscription')
        .set('Authorization', `Bearer ${token}`)
        .send({ plan: 'pro' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.business.plan).toBe('pro');
    });

    it('should return 400 for an invalid plan value', async () => {
      const res = await request(app)
        .post('/api/billing/create-subscription')
        .set('Authorization', `Bearer ${token}`)
        .send({ plan: 'enterprise' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation failed');
    });
  });

  describe('GET /api/billing/status', () => {
    it('should retrieve plan details and outbound message usage stats', async () => {
      // Pre-seed some messages to count usage
      const business = await Business.findById(businessId);
      
      const conv = new Conversation({
        businessId,
        customerPhone: '910000000000',
        status: 'active'
      });
      await conv.save();

      const msg = new Message({
        conversationId: conv._id,
        businessId,
        direction: 'outbound',
        content: 'Broadcast offer',
        handledBy: 'owner'
      });
      await msg.save();

      const res = await request(app)
        .get('/api/billing/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plan).toBe('free');
      expect(res.body.data.usageStats.outboundMessageCount30Days).toBe(1);
    });
  });

  describe('POST /api/billing/webhook', () => {
    beforeEach(async () => {
      // Set the business subscriptionId so webhook can find it
      const business = await Business.findById(businessId);
      if (business) {
        business.subscriptionId = 'sub_active_test_123';
        await business.save();
      }
    });

    it('should upgrade plan and set trialEndsAt to null on subscription.activated', async () => {
      const webhookPayload = {
        event: 'subscription.activated',
        payload: {
          subscription: {
            entity: {
              id: 'sub_active_test_123',
              plan_id: 'plan_pro_123'
            }
          }
        }
      };

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('x-razorpay-signature', 'mock_signature') // Handled specifically in mock mode
        .send(webhookPayload);

      expect(res.status).toBe(200);

      const updated = await Business.findById(businessId);
      expect(updated?.plan).toBe('pro');
      expect(updated?.trialEndsAt).toBeNull();
    });

    it('should downgrade plan to free on subscription.cancelled', async () => {
      // First upgrade the plan
      const business = await Business.findById(businessId);
      if (business) {
        business.plan = 'starter';
        await business.save();
      }

      const webhookPayload = {
        event: 'subscription.cancelled',
        payload: {
          subscription: {
            entity: {
              id: 'sub_active_test_123'
            }
          }
        }
      };

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('x-razorpay-signature', 'mock_signature')
        .send(webhookPayload);

      expect(res.status).toBe(200);

      const updated = await Business.findById(businessId);
      expect(updated?.plan).toBe('free');
      expect(updated?.subscriptionId).toBeUndefined();
    });
  });
});
