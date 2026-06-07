import { Schema, model, Document, Types } from 'mongoose';

export interface IKnowledgeItem extends Document {
  businessId: Types.ObjectId;
  type: 'service' | 'product' | 'faq' | 'policy';
  name: string;
  price?: number;
  duration?: string;
  notes?: string;
  rawRow?: Record<string, any>;
  createdAt: Date;
}

const KnowledgeItemSchema = new Schema<IKnowledgeItem>({
  businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
  type: { type: String, enum: ['service', 'product', 'faq', 'policy'], default: 'service' },
  name: { type: String, required: true },
  price: { type: Number },
  duration: { type: String },
  notes: { type: String },
  rawRow: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

KnowledgeItemSchema.index({ businessId: 1, name: 1 });

export const KnowledgeItem = model<IKnowledgeItem>('KnowledgeItem', KnowledgeItemSchema);
