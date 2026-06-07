import axios from 'axios';
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import dotenv from 'dotenv';
dotenv.config({ override: true });
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

function createMockExcel() {
  const data = [
    {
      Service: 'Haircut',
      Price: 300,
      Duration: '30 mins',
      Description: 'Standard hair styling and trim'
    },
    {
      Service: 'Shaving',
      Price: 150,
      Duration: '15 mins',
      Description: 'Clean shave or beard trim'
    },
    {
      Question: 'Do you take cards?',
      Answer: 'Yes, we accept UPI, cash, and all major credit cards.'
    },
    {
      Policy: 'Cancellation',
      Notes: 'Please cancel appointments at least 2 hours in advance.'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  const dir = path.join(__dirname, 'temp');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, 'mock_catalog.xlsx');
  XLSX.writeFile(wb, filePath);
  return filePath;
}

async function runTests() {
  console.log('--- STARTING BIZREPLY BACKEND INTEGRATION TESTS ---');
  const excelPath = createMockExcel();
  console.log(`[Test Setup] Mock Excel created at: ${excelPath}`);

  let authToken = '';
  let businessId = '';
  let conversationId = '';

  try {
    console.log('\n[Test 1] Testing Business Signup...');
    const signupRes = await axios.post(`${BASE_URL}/api/auth/signup`, {
      name: 'Test Salon',
      email: `test_salon_${Date.now()}@example.com`,
      phone: `919999${Math.floor(100000 + Math.random() * 900000)}`,
      password: 'password123'
    });
    
    if (signupRes.status === 201 && signupRes.data.token) {
      console.log('✔ Signup Successful!');
      authToken = signupRes.data.token;
      businessId = signupRes.data.business.id;
    } else {
      throw new Error('Signup failed.');
    }

    const authHeaders = {
      headers: { Authorization: `Bearer ${authToken}` }
    };

    console.log('\n[Test 2] Updating Business WhatsApp settings...');
    const settingsRes = await axios.put(`${BASE_URL}/api/auth/settings`, {
      whatsappNumber: '919999999999',
      whatsappPhoneId: 'test_meta_phone_id_555',
      whatsappToken: 'test_token_abc'
    }, authHeaders);

    if (settingsRes.status === 200) {
      console.log('✔ Settings Updated successfully.');
    } else {
      throw new Error('Settings update failed.');
    }

    console.log('\n[Test 3] Uploading Excel Catalog...');
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fs.createReadStream(excelPath));

    const uploadRes = await axios.post(`${BASE_URL}/api/knowledge/upload`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${authToken}`
      }
    });

    if (uploadRes.status === 200) {
      console.log(`✔ Excel Upload success! Loaded ${uploadRes.data.count} items.`);
    } else {
      throw new Error('Excel upload failed.');
    }

    console.log('\n[Test 4] Retrieving parsed knowledge items...');
    const listRes = await axios.get(`${BASE_URL}/api/knowledge`, authHeaders);
    if (listRes.status === 200 && listRes.data.length > 0) {
      console.log(`✔ Retrieved ${listRes.data.length} items from DB. First item: "${listRes.data[0].name}"`);
    } else {
      throw new Error('Could not retrieve knowledge items.');
    }

    console.log('\n[Test 5] Simulating Inbound WhatsApp Webhook (greeting: "hi")...');
    const webhookGreetingRes = await axios.post(`${BASE_URL}/api/webhook`, {
      object: 'whatsapp_business_account',
      entry: [{
        id: '12345',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '15550000000',
              phone_number_id: 'test_meta_phone_id_555'
            },
            contacts: [{
              profile: { name: 'Rohan Sharma' },
              wa_id: '918888777766'
            }],
            messages: [{
              from: '918888777766',
              id: `wamid.test_${Date.now()}_1`,
              timestamp: `${Math.floor(Date.now() / 1000)}`,
              text: { body: 'hello' },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    });

    if (webhookGreetingRes.status === 200) {
      console.log('✔ Inbound Webhook event received by server.');
    } else {
      throw new Error('Inbound Webhook failed.');
    }

    await new Promise(r => setTimeout(r, 1000));

    console.log('\n[Test 6] Fetching active Conversations feed...');
    const convRes = await axios.get(`${BASE_URL}/api/conversations`, authHeaders);
    if (convRes.status === 200 && convRes.data.length > 0) {
      conversationId = convRes.data[0]._id;
      console.log(`✔ Found ${convRes.data.length} active conversations. Chat ID: ${conversationId}`);
    } else {
      throw new Error('No conversations generated in DB.');
    }

    console.log('\n[Test 7] Fetching Conversation messages log...');
    const msgRes = await axios.get(`${BASE_URL}/api/conversations/${conversationId}/messages`, authHeaders);
    if (msgRes.status === 200 && msgRes.data.messages.length >= 2) {
      const messages = msgRes.data.messages;
      console.log(`✔ Conversation has ${messages.length} messages.`);
      console.log(`  Customer: "${messages[0].content}" (Handled by: ${messages[0].handledBy})`);
      console.log(`  AI Reply: "${messages[1].content}" (Handled by: ${messages[1].handledBy}, Confidence: ${messages[1].aiConfidence})`);
    } else {
      throw new Error('Message log is empty or lacks AI reply.');
    }

    console.log('\n[Test 8] Simulating Inbound WhatsApp Webhook (matching catalog: "Haircut pricing please")...');
    await axios.post(`${BASE_URL}/api/webhook`, {
      object: 'whatsapp_business_account',
      entry: [{
        id: '12345',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { phone_number_id: 'test_meta_phone_id_555' },
            contacts: [{ profile: { name: 'Rohan Sharma' }, wa_id: '918888777766' }],
            messages: [{
              from: '918888777766',
              id: `wamid.test_${Date.now()}_2`,
              timestamp: `${Math.floor(Date.now() / 1000)}`,
              text: { body: 'Haircut pricing please' },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    });

    await new Promise(r => setTimeout(r, 1000));

    const msgRes2 = await axios.get(`${BASE_URL}/api/conversations/${conversationId}/messages`, authHeaders);
    const messages2 = msgRes2.data.messages;
    console.log(`✔ Conversation messages expanded. Total: ${messages2.length}`);
    console.log(`  Customer: "${messages2[2].content}"`);
    console.log(`  AI Reply: "${messages2[3].content}" (Confidence: ${messages2[3].aiConfidence})`);

    console.log('\n[Test 9] Simulating Inbound WhatsApp Webhook (out-of-scope: "Mars distance")...');
    await axios.post(`${BASE_URL}/api/webhook`, {
      object: 'whatsapp_business_account',
      entry: [{
        id: '12345',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { phone_number_id: 'test_meta_phone_id_555' },
            contacts: [{ profile: { name: 'Rohan Sharma' }, wa_id: '918888777766' }],
            messages: [{
              from: '918888777766',
              id: `wamid.test_${Date.now()}_3`,
              timestamp: `${Math.floor(Date.now() / 1000)}`,
              text: { body: 'how far is Mars from Earth?' },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    });

    await new Promise(r => setTimeout(r, 1000));

    const convStatusRes = await axios.get(`${BASE_URL}/api/conversations`, authHeaders);
    const targetConv = convStatusRes.data[0];
    console.log(`✔ Conversation Status: "${targetConv.status}"`);
    if (targetConv.status === 'needs_attention') {
      console.log('✔ Success: Out-of-scope question flagged "needs_attention" correctly.');
    } else {
      throw new Error('Out-of-scope question failed to flag "needs_attention".');
    }

    console.log('\n[Test 10] Upgrading to PRO subscription...');
    const billingRes = await axios.post(`${BASE_URL}/api/billing/create-subscription`, { plan: 'pro' }, authHeaders);
    if (billingRes.status === 200 && billingRes.data.business.plan === 'pro') {
      console.log(`✔ Upgraded successfully. Current Plan: "${billingRes.data.business.plan}"`);
    } else {
      throw new Error('Billing upgrade failed.');
    }

    console.log('\n[Test 11] Running a broadcast campaign to contacts...');
    const broadcastRes = await axios.post(`${BASE_URL}/api/broadcast/send`, {
      name: 'Diwali Special Offer',
      content: 'Happy Diwali! Today enjoy flat 20% off on Haircuts.',
      targets: ['918888777766', '919999888877']
    }, authHeaders);

    if (broadcastRes.status === 201) {
      console.log('✔ Broadcast triggered successfully and enqueued.');
    } else {
      throw new Error('Broadcast failed.');
    }

    console.log('\n✔✔✔ ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY! ✔✔✔');
  } catch (error: any) {
    console.error('\n✖✖✖ INTEGRATION TEST FAILED! ✖✖✖');
    console.error(error.response?.data || error.message);
    process.exit(1);
  } finally {
    try {
      fs.rmSync(path.join(__dirname, 'temp'), { recursive: true, force: true });
    } catch {}
    process.exit(0);
  }
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bizreply';
mongoose.connect(MONGO_URI).then(() => {
  if (mongoose.connection.db) {
    mongoose.connection.db.collection('businesses').deleteMany({ email: /test_salon/ }).then(() => {
      runTests();
    });
  } else {
    runTests();
  }
});
