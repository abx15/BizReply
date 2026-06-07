import dotenv from 'dotenv';
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import { Business } from '../src/models/Business';
import { KnowledgeItem } from '../src/models/KnowledgeItem';
import { Conversation } from '../src/models/Conversation';
import { Message } from '../src/models/Message';
import { sendMessage } from '../src/services/whatsapp';

dotenv.config({ override: true });

async function verifyAll() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is missing from environment.');
    process.exit(1);
  }

  console.log(`Connecting to: ${mongoUri}`);
  
  try {
    await mongoose.connect(mongoUri);
    console.log('✔ MongoDB connected successfully to Atlas.');

    // 1. Create a mock business to verify DB writes
    const testEmail = `test_biz_${Date.now()}@example.com`;
    const business = new Business({
      name: 'Test Coffee Shop',
      phone: '+919999988887',
      email: testEmail,
      passwordHash: '$2a$10$tZ2cOqN..u5H.qYV.h/gP.mockHashValueHere',
      plan: 'pro',
      whatsappNumber: '+919999988887',
      whatsappToken: 'test_token_value_abc_123',
      whatsappPhoneId: 'test_phone_id_999'
    });

    await business.save();
    console.log(`✔ Created business: ${business.name} (${business.email})`);

    // 2. Add Knowledge Items
    const faqItem = new KnowledgeItem({
      businessId: business._id,
      type: 'faq',
      name: 'What are your hours?',
      notes: 'We are open Mon-Fri from 9 AM to 6 PM.'
    });

    const productItem = new KnowledgeItem({
      businessId: business._id,
      type: 'product',
      name: 'Espresso Coffee',
      price: 180,
      notes: 'Double shot classic italian espresso.'
    });

    await faqItem.save();
    await productItem.save();
    console.log('✔ Created knowledge items (FAQ and Product).');

    // 3. Test sending a WhatsApp message (Mock mode logs outbound)
    console.log('Testing WhatsApp sendMessage service...');
    const customerPhone = '919988776655';
    const msgId = await sendMessage(customerPhone, 'Hello from BizReply test script!', business.whatsappToken || '');
    console.log(`✔ WhatsApp Message sent. Msg ID: ${msgId}`);

    // 4. Verify conversation and message logged in DB
    const conversation = await Conversation.findOne({ businessId: business._id, customerPhone });
    if (conversation) {
      console.log(`✔ Conversation found in DB: Status=${conversation.status}, AI Paused=${conversation.isAiPaused}`);
      
      const loggedMessages = await Message.find({ conversationId: conversation._id });
      console.log(`✔ Logged messages found: ${loggedMessages.length}`);
      loggedMessages.forEach((m, idx) => {
        console.log(`   [${idx + 1}] Direction: ${m.direction}, HandledBy: ${m.handledBy}, Content: "${m.content}"`);
      });
    } else {
      console.error('✘ Conversation not found in DB!');
    }

    // Clean up test records
    console.log('Cleaning up test records from database...');
    await Message.deleteMany({ businessId: business._id });
    await Conversation.deleteMany({ businessId: business._id });
    await KnowledgeItem.deleteMany({ businessId: business._id });
    await Business.deleteOne({ _id: business._id });
    console.log('✔ Database cleanup complete.');

  } catch (err: any) {
    console.error('✘ Verification failed:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

verifyAll();
