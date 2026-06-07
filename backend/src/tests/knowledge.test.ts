import request from 'supertest';
import * as XLSX from 'xlsx';
import { app } from '../index';
import { connectMemoryDb, closeMemoryDb, clearMemoryDb } from './setup';
import { KnowledgeItem } from '../models/KnowledgeItem';

beforeAll(async () => {
  await connectMemoryDb();
});

afterAll(async () => {
  await closeMemoryDb();
});

beforeEach(async () => {
  await clearMemoryDb();
});

function createMockExcelBuffer(): Buffer {
  const data = [
    { Service: 'Mens Haircut', Price: 350, Duration: '20 mins', Description: 'Quick haircut' },
    { Product: 'Hair Wax', Price: 200, Description: 'Strong hold styling gel' },
    { Question: 'Do you accept UPI?', Answer: 'Yes, GPay and PhonePe' }
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('Knowledge Base API Tests', () => {
  let token = '';
  let businessId = '';

  beforeEach(async () => {
    // Signup to get a valid token
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Grooming Parlour',
        email: 'groom@parlour.com',
        phone: '919000111222',
        password: 'password123'
      });
    
    token = signupRes.body.data.token;
    businessId = signupRes.body.data.business.id;
  });

  describe('POST /api/knowledge/upload', () => {
    it('should successfully parse and save valid Excel catalog', async () => {
      const buffer = createMockExcelBuffer();

      const res = await request(app)
        .post('/api/knowledge/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', buffer, 'catalog.xlsx');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(3);

      const items = await KnowledgeItem.find({ businessId });
      expect(items.length).toBe(3);
      
      const faqItem = items.find(i => i.type === 'faq');
      expect(faqItem).toBeTruthy();
      expect(faqItem?.name).toBe('Do you accept UPI?');
      expect(faqItem?.notes).toBe('Yes, GPay and PhonePe');
    });

    it('should return 400 if no file is uploaded', async () => {
      const res = await request(app)
        .post('/api/knowledge/upload')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('upload an Excel file');
    });
  });

  describe('CRUD Operations', () => {
    let testItem: any;

    beforeEach(async () => {
      // Pre-seed a knowledge item
      testItem = new KnowledgeItem({
        businessId,
        type: 'service',
        name: 'Facial Massage',
        price: 500,
        duration: '45 mins',
        notes: 'Includes steam treatment'
      });
      await testItem.save();
    });

    it('should retrieve all items for the authenticated business', async () => {
      const res = await request(app)
        .get('/api/knowledge')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Facial Massage');
    });

    it('should successfully create a new knowledge item manually', async () => {
      const res = await request(app)
        .post('/api/knowledge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'product',
          name: 'Beard Oil',
          price: 150,
          notes: 'Organic sandalwood flavor'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Beard Oil');
      expect(res.body.data.price).toBe(150);
    });

    it('should successfully edit an existing item', async () => {
      const res = await request(app)
        .put(`/api/knowledge/${testItem._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          price: 600, // Update price
          notes: 'Includes steam treatment & peel mask'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.price).toBe(600);
      expect(res.body.data.notes).toContain('peel mask');
    });

    it('should successfully delete an item', async () => {
      const res = await request(app)
        .delete(`/api/knowledge/${testItem._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const found = await KnowledgeItem.findById(testItem._id);
      expect(found).toBeNull();
    });
  });
});
