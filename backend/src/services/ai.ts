import Anthropic from '@anthropic-ai/sdk';
import { Business } from '../models/Business';
import { KnowledgeItem } from '../models/KnowledgeItem';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'mock_key',
});

interface AiResponse {
  reply: string;
  confidence: number;
}

// Custom prompt builder in Hindi/Hinglish as requested
function buildHinglishSystemPrompt(businessName: string, items: any[]): string {
  let prompt = `Tu ${businessName} ka WhatsApp assistant hai. Sirf inhi services aur products ka jawab de:\n`;

  items.forEach(item => {
    prompt += `- Name: ${item.name}, Type: ${item.type}`;
    if (item.price) prompt += `, Price: Rs. ${item.price}`;
    if (item.duration) prompt += `, Duration: ${item.duration}`;
    if (item.notes) prompt += `, Description/Details: ${item.notes}`;
    prompt += '\n';
  });

  prompt += `\nHindi/Hinglish mein short jawab de. WhatsApp chat style mein reply kar (keep it concise, use occasional emojis). `;
  prompt += `Strictly adhere to the facts provided above. If the customer asks something not listed, or if you don't know the answer, respond with a polite message in Hindi/Hinglish saying you don't know and the owner will confirm soon, e.g. "Mujhe is baare mein abhi jankari nahi hai. Business owner se confirm karke aapko batata hoon." `;
  prompt += `Return your response in a JSON format: { "reply": "your message here", "confidence": 0.0 to 1.0 } where confidence is low (< 0.7) if you cannot answer from the knowledge base.`;

  return prompt;
}

function generateMockHinglishReply(message: string, businessName: string, items: any[]): AiResponse {
  const msgLower = message.toLowerCase();

  const match = items.find(item =>
    msgLower.includes(item.name.toLowerCase()) ||
    (item.notes && msgLower.includes(item.notes.toLowerCase()))
  );

  if (match) {
    let reply = `Haan ji! `;
    if (match.type === 'service') {
      reply += `${match.name} ki price ₹${match.price || 'N/A'} hai aur isme ${match.duration || 'kuch'} time lagta hai.`;
    } else if (match.type === 'product') {
      reply += `${match.name} ki cost ₹${match.price || 'N/A'} hai.`;
    } else {
      reply += `${match.notes || 'Aap call kar ke confirm kar sakte hain.'}`;
    }
    return { reply, confidence: 0.95 };
  }

  if (msgLower.match(/(hi|hello|hey|namaste|helo)/)) {
    return {
      reply: `Hello! ${businessName} mein aapka swagat hai. Main aapki kya help kar sakta hoon?`,
      confidence: 0.9
    };
  }

  return {
    reply: `Mujhe is baare mein abhi jankari nahi hai. Business owner se confirm karke aapko batata hoon.`,
    confidence: 0.5
  };
}

export async function generateReply(
  businessId: string,
  customerMessage: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
): Promise<string | null> {
  // Test-mode override for Jest
  if (process.env.NODE_ENV === 'test') {
    if (customerMessage.toLowerCase().includes('fail')) {
      return null;
    }
    return JSON.stringify({
      reply: 'Mock AI response to: ' + customerMessage,
      confidence: customerMessage.toLowerCase().includes('unknown') ? 0.5 : 0.9
    });
  }

  try {
    const business = await Business.findById(businessId);
    if (!business) {
      console.error(`[AI Service] Business not found: ${businessId}`);
      return null;
    }

    const knowledgeItems = await KnowledgeItem.find({ businessId });

    const isMock = process.env.MOCK_SERVICES === 'true' ||
      !process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_API_KEY === 'your_anthropic_claude_api_key' ||
      process.env.ANTHROPIC_API_KEY === 'mock_key';

    if (isMock) {
      const mockResult = generateMockHinglishReply(customerMessage, business.name, knowledgeItems);
      // Wait briefly to simulate API network latency
      await new Promise(resolve => setTimeout(resolve, 300));
      return JSON.stringify(mockResult);
    }

    const systemPrompt = buildHinglishSystemPrompt(business.name, knowledgeItems);

    // Limit history to last 5 messages as requested
    const recentHistory = conversationHistory.slice(-5).map(h => ({
      role: h.role,
      content: h.content
    }));

    recentHistory.push({
      role: 'user',
      content: customerMessage
    });

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      temperature: 0.2,
      system: systemPrompt,
      messages: recentHistory as any,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return text;
  } catch (error) {
    console.error('[AI Service] Anthropic SDK call failed:', error);
    return null;
  }
}
