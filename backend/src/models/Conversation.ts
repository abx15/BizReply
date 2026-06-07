import { Schema, model, Document, Types } from 'mongoose';

export interface IConversation extends Document {
  businessId: Types.ObjectId;
  customerPhone: string;
  customerName?: string;
  status: 'active' | 'resolved' | 'needs_attention';
  isAiPaused: boolean;
  lastMessageAt: Date;
  createdAt: Date;
}

const ConversationSchema = new Schema<IConversation>({
  businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
  customerPhone: { type: String, required: true },
  customerName: { type: String, default: '' },
  status: { type: String, enum: ['active', 'resolved', 'needs_attention'], default: 'active' },
  isAiPaused: { type: Boolean, default: false },
  lastMessageAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

ConversationSchema.index({ businessId: 1, customerPhone: 1 }, { unique: true });

export const Conversation = model<IConversation>('Conversation', ConversationSchema);
