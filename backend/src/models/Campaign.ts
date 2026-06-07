import { Schema, model, Document, Types } from 'mongoose';

export interface ICampaign extends Document {
  businessId: Types.ObjectId;
  name: string;
  content: string;
  targets: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduledAt: Date;
  createdAt: Date;
}

const CampaignSchema = new Schema<ICampaign>({
  businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
  name: { type: String, required: true },
  content: { type: String, required: true },
  targets: { type: [String], required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  scheduledAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Campaign = model<ICampaign>('Campaign', CampaignSchema);
