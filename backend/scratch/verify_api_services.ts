import dotenv from 'dotenv';
dotenv.config({ override: true });
// Set NODE_ENV to verify to prevent index.ts from automatically listening on port 5000
process.env.NODE_ENV = 'verify';

import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import axios from 'axios';
import { app, server } from '../src/index';
import { Business } from '../src/models/Business';
import { KnowledgeItem } from '../src/models/KnowledgeItem';
import { Conversation } from '../src/models/Conversation';
import { Message } from '../src/models/Message';

const PORT = 5088;
const BASE_URL = `http://localhost:${PORT}`;

async function runVerification() {
  console.log('--- BizReply Full Backend Services & API Verification ---');
  
  // 1. Start test server
  console.log(`Starting test server on port ${PORT}...`);
  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      console.log(`✔ Test server listening at ${BASE_URL}`);
      resolve();
    });
  });

  const randSuffix = Date.now();
  const testBusinessData = {
    name: 'Verification Tea Shop',
    email: `tea_shop_${randSuffix}@example.com`,
    phone: `+9188888${randSuffix.toString().slice(-7)}`,
    password: 'verificationSecretPass123'
  };

  let token = '';
  let businessId = '';

  try {
    // 2. Test Signup
    console.log('\nTesting POST /api/auth/signup...');
    const signupRes = await axios.post(`${BASE_URL}/api/auth/signup`, testBusinessData);
    
    if (signupRes.status === 201 && signupRes.data.success) {
      console.log('✔ Signup Successful!');
      console.log(`  Registered Email: ${signupRes.data.data.business.email}`);
      console.log(`  Plan: ${signupRes.data.data.business.plan}`);
    } else {
      throw new Error(`Signup failed: ${JSON.stringify(signupRes.data)}`);
    }

    // 3. Test Login
    console.log('\nTesting POST /api/auth/login...');
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: testBusinessData.email,
      password: testBusinessData.password
    });

    if (loginRes.status === 200 && loginRes.data.success) {
      console.log('✔ Login Successful!');
      token = loginRes.data.data.token;
      businessId = loginRes.data.data.business.id;
      console.log(`  JWT Token: ${token.substring(0, 30)}...`);
    } else {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
    }

    // Headers with token
    const headers = { Authorization: `Bearer ${token}` };

    // 4. Test Fetch Profile (GET /api/business/me)
    console.log('\nTesting GET /api/business/me...');
    const meRes = await axios.get(`${BASE_URL}/api/business/me`, { headers });
    
    if (meRes.status === 200 && meRes.data.success) {
      console.log('✔ Profile Retrieval Successful!');
      console.log(`  Business Name: ${meRes.data.data.name}`);
      console.log(`  AI Enabled: ${meRes.data.data.aiEnabled}`);
    } else {
      throw new Error(`Fetch profile failed: ${JSON.stringify(meRes.data)}`);
    }

    // 5. Test Update Profile (PUT /api/business/update)
    console.log('\nTesting PUT /api/business/update...');
    const updateRes = await axios.put(`${BASE_URL}/api/business/update`, {
      whatsappNumber: '+919988776655',
      whatsappPhoneId: 'test_phone_id_999',
      whatsappToken: 'test_token_abc_123',
      aiEnabled: true
    }, { headers });

    if (updateRes.status === 200 && updateRes.data.success) {
      console.log('✔ Profile Update Successful!');
      console.log(`  WhatsApp Phone ID: ${updateRes.data.data.whatsappPhoneId}`);
      console.log(`  WhatsApp Token: ${updateRes.data.data.whatsappToken}`);
    } else {
      throw new Error(`Update profile failed: ${JSON.stringify(updateRes.data)}`);
    }

    // 6. Test Create Knowledge Item (POST /api/knowledge)
    console.log('\nTesting POST /api/knowledge...');
    const kiRes = await axios.post(`${BASE_URL}/api/knowledge`, {
      type: 'product',
      name: 'Masala Chai',
      price: '40',
      duration: '5 mins',
      notes: 'Authentic Indian spiced milk tea.'
    }, { headers });

    if (kiRes.status === 201 && kiRes.data.success) {
      console.log('✔ Create Knowledge Item Successful!');
      console.log(`  Item: ${kiRes.data.data.name} (Price: Rs. ${kiRes.data.data.price})`);
    } else {
      throw new Error(`Create knowledge item failed: ${JSON.stringify(kiRes.data)}`);
    }

    // 7. Test Incoming Webhook simulating WhatsApp Message (POST /api/webhook)
    console.log('\nTesting POST /api/webhook (Simulated Incoming WhatsApp Message)...');
    
    const mockWebhookData = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba_verification_test',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '16505550000',
                  phone_number_id: 'test_phone_id_999' // Matches the business whatsappPhoneId
                },
                contacts: [
                  {
                    profile: {
                      name: 'Rahul Kumar'
                    },
                    wa_id: '919876543210'
                  }
                ],
                messages: [
                  {
                    from: '919876543210',
                    id: `wamid.verify_${Date.now()}`,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    text: {
                      body: 'Bhai, Masala Chai milegi kya?' // Query matches knowledge base
                    },
                    type: 'text'
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const webhookRes = await axios.post(`${BASE_URL}/api/webhook`, mockWebhookData);
    if (webhookRes.status === 200) {
      console.log('✔ Webhook POST Request Received (Status 200 OK)');
      
      // Wait for async AI processing and reply generation to write to DB
      console.log('Waiting 1.5 seconds for AI response generation and db logging...');
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 8. Verify Conversation and Messages in DB
      console.log('\nVerifying Conversation and Messages logged in Database...');
      const conversation = await Conversation.findOne({ businessId, customerPhone: '919876543210' });
      
      if (conversation) {
        console.log(`✔ Found Conversation in DB! Status: ${conversation.status}`);
        
        const loggedMessages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
        console.log(`✔ Found ${loggedMessages.length} Messages in DB:`);
        
        loggedMessages.forEach((msg, index) => {
          console.log(`  [Message ${index + 1}] Direction: ${msg.direction}, Content: "${msg.content}", HandledBy: ${msg.handledBy}`);
        });

        const hasOutbound = loggedMessages.some(m => m.direction === 'outbound' && m.handledBy === 'ai');
        if (hasOutbound) {
          console.log('✔ WhatsApp Auto-Responder / Send Service successfully triggered!');
        } else {
          console.error('✘ AI Auto-Responder outbound message not found in DB!');
        }
      } else {
        console.error('✘ Conversation not found in Database!');
      }
    } else {
      throw new Error(`Webhook POST failed: ${webhookRes.status}`);
    }

    // 9. Test Logout Endpoint (POST /api/auth/logout)
    console.log('\nTesting POST /api/auth/logout...');
    const logoutRes = await axios.post(`${BASE_URL}/api/auth/logout`, {}, { headers });
    if (logoutRes.status === 200 && logoutRes.data.success) {
      console.log('✔ Logout Endpoint Successful!');
    } else {
      throw new Error(`Logout failed: ${JSON.stringify(logoutRes.data)}`);
    }

  } catch (error: any) {
    console.error('\n✘ Verification failed during execution:', error.response?.data || error.message);
  } finally {
    // 10. Database Cleanup
    if (businessId) {
      console.log('\nCleaning up verification records from database...');
      const messagesDeleted = await Message.deleteMany({ businessId });
      const convosDeleted = await Conversation.deleteMany({ businessId });
      const kiDeleted = await KnowledgeItem.deleteMany({ businessId });
      const businessDeleted = await Business.deleteOne({ _id: businessId });
      console.log(`✔ Cleanup Complete:`);
      console.log(`  Deleted Businesses: ${businessDeleted.deletedCount}`);
      console.log(`  Deleted Knowledge Items: ${kiDeleted.deletedCount}`);
      console.log(`  Deleted Conversations: ${convosDeleted.deletedCount}`);
      console.log(`  Deleted Messages: ${messagesDeleted.deletedCount}`);
    }

    // 11. Shut down test server and close DB connection
    console.log('\nShutting down test server and disconnecting from MongoDB...');
    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log('✔ Test server stopped.');
        resolve();
      });
    });
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('✔ MongoDB disconnected.');
    }
    console.log('\n--- Verification Script Completed ---');
  }
}

runVerification();
