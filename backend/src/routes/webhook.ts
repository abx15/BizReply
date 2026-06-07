import { Router, Response, Request } from 'express';
import { Business } from '../models/Business';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { generateReply } from '../services/ai';
import { sendWhatsAppMessage } from '../services/whatsapp';

const router = Router();

// GET /api/webhook — Meta Webhook verification
router.get('/', (req: Request, res: Response) => {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'verify_token_default';
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[Webhook] Meta challenge verified successfully.');
      return res.status(200).send(challenge);
    } else {
      console.warn('[Webhook] Verification failed. Tokens mismatch.');
      return res.sendStatus(403);
    }
  }
  return res.sendStatus(400);
});

// POST /api/webhook — receive incoming WhatsApp messages
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Send 200 OK immediately to Meta (before AI responds)
    res.status(200).send('EVENT_RECEIVED');

    if (!body || body.object !== 'whatsapp_business_account') {
      return;
    }

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    // Only process text messages
    if (!message || message.type !== 'text') {
      return;
    }

    const phoneId = value?.metadata?.phone_number_id;
    const customerPhone = message.from;
    const customerName = value?.contacts?.[0]?.profile?.name || 'Customer';
    const messageText = message.text?.body;
    const whatsappMsgId = message.id;

    console.log(`[Webhook] Incoming message from ${customerPhone}: "${messageText}"`);

    // Find business
    let business = await Business.findOne({ whatsappPhoneId: phoneId });
    if (!business && process.env.MOCK_SERVICES === 'true') {
      // Fallback for mock/testing environments
      business = await Business.findOne();
    }

    if (!business) {
      console.warn(`[Webhook] Message received, but no business found with Phone ID: ${phoneId}`);
      return;
    }

    // Check trial ends
    const isTrialEnded = business.plan === 'free' && 
      (business.trialEndsAt ? new Date() > new Date(business.trialEndsAt) : true);
    if (isTrialEnded) {
      console.warn(`[Webhook] Business ${business.name} trial is expired. Ignoring webhook processing.`);
      return;
    }

    // Find or create Conversation
    let conversation = await Conversation.findOne({
      businessId: business._id,
      customerPhone
    });

    if (!conversation) {
      conversation = new Conversation({
        businessId: business._id,
        customerPhone,
        customerName,
        status: 'active',
        lastMessageAt: new Date()
      });
    } else {
      conversation.lastMessageAt = new Date();
      if (conversation.status === 'resolved') {
        conversation.status = 'active';
      }
    }
    await conversation.save();

    // Save inbound message
    const inboundMessage = new Message({
      conversationId: conversation._id,
      businessId: business._id,
      direction: 'inbound',
      content: messageText,
      handledBy: 'owner',
      whatsappMsgId
    });
    await inboundMessage.save();

    // Emit socket event for new inbound message
    const io = req.app.get('io');
    if (io) {
      io.to(business._id.toString()).emit('new_message', {
        conversation,
        message: inboundMessage
      });
    }

    // Trigger AI reply service asynchronously
    if (business.aiEnabled && !conversation.isAiPaused) {
      // Get conversation history (last 5 messages)
      const messagesHistory = await Message.find({ conversationId: conversation._id })
        .sort({ createdAt: -1 })
        .limit(6); // limit 6 so we can exclude the current inbound message
      
      const history = messagesHistory
        .filter(m => m._id.toString() !== inboundMessage._id.toString())
        .reverse()
        .map(m => ({
          role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const,
          content: m.content
        }));

      console.log(`[Webhook] Requesting AI reply for ${customerPhone}...`);
      const aiResponseRaw = await generateReply(business._id.toString(), messageText, history);
      console.log(`[Webhook] AI Service response raw:`, aiResponseRaw);

      if (!aiResponseRaw) {
        // API failed: mark conversation as needs_attention, notify owner
        conversation.status = 'needs_attention';
        await conversation.save();
        
        if (io) {
          io.to(business._id.toString()).emit('conversationStatusChanged', conversation);
        }
        return;
      }

      let replyText = aiResponseRaw;
      let confidence = 1.0;

      // Try parsing JSON format
      try {
        const jsonMatch = aiResponseRaw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          replyText = parsed.reply;
          confidence = parsed.confidence ?? 0.8;
        }
      } catch (err) {
        // Fallback to raw string
      }

      // If confidence is low, mark as needs_attention
      if (confidence < 0.7) {
        conversation.status = 'needs_attention';
        await conversation.save();
        if (io) {
          io.to(business._id.toString()).emit('conversationStatusChanged', conversation);
        }
      }

      // Send outbound message
      const outboundMsgId = await sendWhatsAppMessage(customerPhone, replyText, business);

      // Save outbound message
      const outboundMessage = new Message({
        conversationId: conversation._id,
        businessId: business._id,
        direction: 'outbound',
        content: replyText,
        handledBy: 'ai',
        aiConfidence: confidence,
        whatsappMsgId: outboundMsgId
      });
      await outboundMessage.save();

      // Emit socket event for AI replied
      if (io) {
        io.to(business._id.toString()).emit('ai_replied', {
          conversation,
          message: outboundMessage
        });
      }
    }
  } catch (error: any) {
    console.error('[Webhook Error] Error handling event:', error);
  }
});

export default router;
