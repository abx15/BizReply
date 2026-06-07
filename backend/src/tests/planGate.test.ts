import request from 'supertest';
import { app } from '../index';
import { connectMemoryDb, closeMemoryDb, clearMemoryDb } from './setup';
import { Business } from '../models/Business';
import { Conversation } from '../models/Conversation';

describe('Plan Gate Middleware Tests', () => {
  let freeToken = '';
  let proToken = '';
  let businessId = '';

  beforeAll(async () => {
    await connectMemoryDb();
  });

  afterAll(async () => {
    await closeMemoryDb();
  });

  beforeEach(async () => {
    await clearMemoryDb();
    
    // Register free business
    const signupFree = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Free Salon',
        email: 'free@salon.com',
        phone: '911111111111',
        password: 'password123'
      });
    freeToken = signupFree.body.data.token;
    businessId = signupFree.body.data.business.id;

    // Seed conversation for contact target matching
    const conv = new Conversation({
      businessId,
      customerPhone: '919999888877',
      status: 'active'
    });
    await conv.save();

    // Register pro business
    const signupPro = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Pro Salon',
        email: 'pro@salon.com',
        phone: '912222222222',
        password: 'password123'
      });
    proToken = signupPro.body.data.token;

    // Seed conversation for pro business contact target matching
    const convPro = new Conversation({
      businessId: signupPro.body.data.business.id,
      customerPhone: '919999888877',
      status: 'active'
    });
    await convPro.save();

    // Upgrade the pro business directly in DB
    await Business.findByIdAndUpdate(signupPro.body.data.business.id, { plan: 'pro' });
  });

  it('should deny access to PRO feature (broadcast) for FREE plan', async () => {
    const res = await request(app)
      .post('/api/broadcast/send')
      .set('Authorization', `Bearer ${freeToken}`)
      .send({
        message: 'Diwali Special 20% off'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('requires the PRO plan');
  });

  it('should allow access to PRO feature (broadcast) for PRO plan', async () => {
    const res = await request(app)
      .post('/api/broadcast/send')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        message: 'Diwali Special 20% off'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');
  });

  it('should deny access if the free trial has expired', async () => {
    // Manually expire trial
    await Business.findByIdAndUpdate(businessId, {
      trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
    });

    const res = await request(app)
      .post('/api/broadcast/send')
      .set('Authorization', `Bearer ${freeToken}`)
      .send({
        message: 'Expired trial offer'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('free trial has expired');
  });
});
