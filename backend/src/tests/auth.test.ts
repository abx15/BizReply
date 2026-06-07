import request from 'supertest';
import { app } from '../index';
import { connectMemoryDb, closeMemoryDb, clearMemoryDb } from './setup';
import { Business } from '../models/Business';

beforeAll(async () => {
  await connectMemoryDb();
});

afterAll(async () => {
  await closeMemoryDb();
});

beforeEach(async () => {
  await clearMemoryDb();
});

describe('Authentication API Tests', () => {
  const testBusiness = {
    name: 'Salon Deluxe',
    email: 'deluxe@salon.com',
    phone: '919876543210',
    password: 'securepassword123'
  };

  describe('POST /api/auth/signup', () => {
    it('should successfully register a new business', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(testBusiness);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.business.name).toBe(testBusiness.name);
      expect(res.body.data.business.email).toBe(testBusiness.email);
      expect(res.body.data.business.plan).toBe('free');

      // Verify DB document exists
      const dbBusiness = await Business.findOne({ email: testBusiness.email });
      expect(dbBusiness).toBeTruthy();
    });

    it('should reject registration if email or phone is already taken', async () => {
      // Register first time
      await request(app)
        .post('/api/auth/signup')
        .send(testBusiness);

      // Register second time
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...testBusiness,
          email: 'another@email.com' // Duplicate phone
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should fail validation when fields are missing or invalid', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: '',
          email: 'invalid-email',
          phone: '',
          password: '123' // too short
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.data.length).toBeGreaterThanOrEqual(4); // 4 validation errors
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register a business for login tests
      await request(app)
        .post('/api/auth/signup')
        .send(testBusiness);
    });

    it('should successfully authenticate with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testBusiness.email,
          password: testBusiness.password
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.business.email).toBe(testBusiness.email);
    });

    it('should fail authentication with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testBusiness.email,
          password: 'wrongpassword'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid credentials.');
    });

    it('should fail authentication if email does not exist', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@salon.com',
          password: testBusiness.password
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid credentials.');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully log out', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logout successful.');
    });
  });
});
