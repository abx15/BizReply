import { Schema, model, Document, Types } from 'mongoose';

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  businessId: Types.ObjectId;
  direction: 'inbound' | 'outbound';
  content: string;
  handledBy: 'ai' | 'owner' | 'system';
  aiConfidence?: number;
  whatsappMsgId?: string;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  content: { type: String, required: true },
  handledBy: { type: String, enum: ['ai', 'owner', 'system'], default: 'owner' },
  aiConfidence: { type: Number },
  whatsappMsgId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

MessageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message = model<IMessage>('Message', MessageSchema);
