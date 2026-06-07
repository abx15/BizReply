import request from 'supertest';
import { connectMemoryDb, closeMemoryDb, clearMemoryDb } from './setup';

// Mock whatsapp service to isolate webhook logic before requiring app
jest.doMock('../services/whatsapp', () => ({
  __esModule: true,
  sendWhatsAppMessage: jest.fn().mockResolvedValue('wamid.test_outbound_123'),
  sendMessage: jest.fn().mockResolvedValue('wamid.test_outbound_123')
}));

// Require app and models after mocking
const { app } = require('../index');
const { Business } = require('../models/Business');
const { Conversation } = require('../models/Conversation');
const { Message } = require('../models/Message');

beforeAll(async () => {
  await connectMemoryDb();
});

afterAll(async () => {
  await closeMemoryDb();
});

beforeEach(async () => {
  await clearMemoryDb();
  process.env.META_WEBHOOK_VERIFY_TOKEN = 'test_verify_token';
});

describe('WhatsApp Webhook API Tests', () => {
  let business: any;

  beforeEach(async () => {
    // Create a mock business profile matching incoming Phone ID
    business = new Business({
      name: 'Saloon Super',
      email: 'salon@super.com',
      phone: '918888888888',
      passwordHash: 'hashed_password',
      whatsappPhoneId: 'phone_id_abc',
      whatsappNumber: '918888888888',
      whatsappToken: 'token_123',
      plan: 'free',
      trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // Active trial
    });
    await business.save();
  });

  describe('GET /api/webhook', () => {
    it('should verify webhook successfully with matching token', async () => {
      const res = await request(app)
        .get('/api/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test_verify_token',
          'hub.challenge': '1158201484'
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe('1158201484');
    });

    it('should return 403 on verify request with mismatching token', async () => {
      const res = await request(app)
        .get('/api/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': '1158201484'
        });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/webhook', () => {
    const createWebhookBody = (fromPhone: string, text: string) => ({
      object: 'whatsapp_business_account',
      entry: [{
        id: '12345',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '15550000000',
              phone_number_id: 'phone_id_abc'
            },
            contacts: [{
              profile: { name: 'Rahul Dev' },
              wa_id: fromPhone
            }],
            messages: [{
              from: fromPhone,
              id: 'wamid.HBgLOTE5OTk5OTk5OQ==',
              timestamp: '1600000000',
              text: { body: text },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    });

    it('should accept message and process AI reply immediately (returning 200 OK)', async () => {
      const payload = createWebhookBody('919999888877', 'What are your hours?');
      
      const res = await request(app)
        .post('/api/webhook')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.text).toBe('EVENT_RECEIVED');

      // Wait 500ms for async execution
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify conversation creation
      const conv = await Conversation.findOne({ customerPhone: '919999888877' });
      expect(conv).toBeTruthy();
      expect(conv?.status).toBe('active');

      // Verify messages logged (1 inbound, 1 outbound)
      const messages = await Message.find({ conversationId: conv?._id }).sort({ createdAt: 1 });
      expect(messages.length).toBe(2);
      expect(messages[0].direction).toBe('inbound');
      expect(messages[0].content).toBe('What are your hours?');
      expect(messages[1].direction).toBe('outbound');
      expect(messages[1].handledBy).toBe('ai');
      expect(messages[1].content).toContain('Mock AI response to:');
    });

    it('should flag conversation as needs_attention if AI response is uncertain', async () => {
      const payload = createWebhookBody('919999888877', 'Unknown query to test confidence');

      await request(app)
        .post('/api/webhook')
        .send(payload);

      // Wait 500ms for async execution
      await new Promise(resolve => setTimeout(resolve, 500));

      const conv = await Conversation.findOne({ customerPhone: '919999888877' });
      expect(conv).toBeTruthy();
      expect(conv?.status).toBe('needs_attention');
    });

    it('should flag conversation as needs_attention and not send reply if AI service fails (returns null)', async () => {
      const payload = createWebhookBody('919999888877', 'Query to trigger fail condition');

      await request(app)
        .post('/api/webhook')
        .send(payload);

      // Wait 500ms for async execution
      await new Promise(resolve => setTimeout(resolve, 500));

      const conv = await Conversation.findOne({ customerPhone: '919999888877' });
      expect(conv?.status).toBe('needs_attention');

      // Verify only 1 message (inbound) exists
      const messages = await Message.find({ conversationId: conv?._id });
      expect(messages.length).toBe(1);
      expect(messages[0].direction).toBe('inbound');
    });
  });
});
