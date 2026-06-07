import axios from 'axios';
import { Business } from '../models/Business';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';

// Core function requested: sendMessage(toPhone, messageText, businessToken)
export async function sendMessage(
  toPhone: string,
  messageText: string,
  businessToken: string
): Promise<string> {
  try {
    // Find the business by token or default to WHATSAPP_API_TOKEN env
    let business = await Business.findOne({ whatsappToken: businessToken });
    if (!business) {
      business = await Business.findOne({ whatsappToken: process.env.WHATSAPP_API_TOKEN });
      if (!business) {
        if (process.env.MOCK_SERVICES === 'true' || process.env.NODE_ENV === 'test') {
          business = await Business.findOne();
        }
      }
    }

    if (!business) {
      throw new Error('Business profile not found for the provided token.');
    }

    const phoneId = business.whatsappPhoneId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!phoneId) {
      throw new Error('WhatsApp Phone Number ID is missing.');
    }

    let msgId = `wamid.MOCK_${Math.random().toString(36).substring(2, 15)}`;

    const isMock = process.env.MOCK_SERVICES === 'true' || 
                   !businessToken || 
                   businessToken === 'your_meta_system_user_access_token' || 
                   businessToken.startsWith('test_token');

    if (!isMock) {
      const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
      try {
        const response = await axios.post(
          url,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: toPhone,
            type: 'text',
            text: {
              preview_url: false,
              body: messageText,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${businessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        msgId = response.data?.messages?.[0]?.id || msgId;
      } catch (err: any) {
        // Handle rate limit errors (429) gracefully
        if (err.response?.status === 429) {
          console.warn('[WhatsApp Service] Rate limit exceeded (429). Logged and proceeding.');
        }
        console.error('[WhatsApp Service] Meta WhatsApp API Error:', err.response?.data || err.message);
        throw new Error(err.response?.data?.error?.message || err.message);
      }
    } else {
      console.log(`\n--- [MOCK OUTBOUND WHATSAPP MESSAGE] ---`);
      console.log(`To: ${toPhone}`);
      console.log(`From Business: ${business.name} (Phone ID: ${phoneId})`);
      console.log(`Message: "${messageText}"`);
      console.log(`Generated ID: ${msgId}`);
      console.log(`----------------------------------------\n`);
    }

    // Find or create conversation for logging
    let conversation = await Conversation.findOne({
      businessId: business._id,
      customerPhone: toPhone,
    });

    if (!conversation) {
      conversation = new Conversation({
        businessId: business._id,
        customerPhone: toPhone,
        customerName: 'Customer',
        status: 'active',
        lastMessageAt: new Date(),
      });
      await conversation.save();
    } else {
      conversation.lastMessageAt = new Date();
      await conversation.save();
    }

    // Save message log
    const outboundMessage = new Message({
      conversationId: conversation._id,
      businessId: business._id,
      direction: 'outbound',
      content: messageText,
      handledBy: 'owner',
      whatsappMsgId: msgId,
    });
    await outboundMessage.save();

    return msgId;
  } catch (error: any) {
    console.error('[WhatsApp Service] Failed to send message:', error.message);
    throw error;
  }
}

// Webhook-compatible wrapper
export async function sendWhatsAppMessage(
  to: string,
  content: string,
  business: any
): Promise<string> {
  const token = business.whatsappToken || process.env.WHATSAPP_API_TOKEN || 'mock_token';
  return sendMessage(to, content, token);
}
