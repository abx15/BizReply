import { Schema, model, Document } from 'mongoose';

export interface IBusiness extends Document {
  name: string;
  phone: string;
  email: string;
  passwordHash: string;
  whatsappNumber?: string;
  whatsappToken?: string;
  whatsappPhoneId?: string;
  plan: 'free' | 'starter' | 'pro';
  trialEndsAt?: Date | null;
  subscriptionId?: string;
  businessHours: {
    open: string;
    close: string;
    days: number[];
  };
  aiEnabled: boolean;
  createdAt: Date;
}

const BusinessSchema = new Schema<IBusiness>({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  whatsappNumber: { type: String },
  whatsappToken: { type: String },
  whatsappPhoneId: { type: String },
  plan: { type: String, enum: ['free', 'starter', 'pro'], default: 'free' },
  trialEndsAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  subscriptionId: { type: String },
  businessHours: {
    open: { type: String, default: "09:00" },
    close: { type: String, default: "18:00" },
    days: { type: [Number], default: [1, 2, 3, 4, 5] }
  },
  aiEnabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export const Business = model<IBusiness>('Business', BusinessSchema);
