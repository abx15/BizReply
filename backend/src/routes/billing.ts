import { Router, Response } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { body } from 'express-validator';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { Business } from '../models/Business';
import { Message } from '../models/Message';
import { validateRequest } from '../middleware/validate';

const router = Router();

let razorpay: Razorpay | null = null;
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (keyId && keySecret && keyId !== 'your_razorpay_key_id') {
  razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
}

const PLAN_IDS: Record<string, string> = {
  starter: 'plan_starter_123',
  pro: 'plan_pro_123'
};

// POST /api/billing/create-subscription
router.post(
  '/create-subscription',
  authMiddleware as any,
  [
    body('plan').isIn(['starter', 'pro']).withMessage('Invalid plan selected. Must be starter or pro.')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { plan } = req.body;
      const business = await Business.findById(req.business?.id);
      if (!business) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Business profile not found.'
        });
      }

      if (process.env.MOCK_SERVICES === 'true' || !razorpay) {
        business.plan = plan as 'starter' | 'pro';
        business.subscriptionId = `sub_mock_${Math.random().toString(36).substring(2, 10)}`;
        business.trialEndsAt = null; // Activation sets trialEndsAt to null as requested
        await business.save();

        const updated = business.toObject();
        delete (updated as any).passwordHash;

        return res.status(200).json({
          success: true,
          data: {
            mock: true,
            business: updated
          },
          message: 'Mock subscription created and activated successfully.'
        });
      }

      const planId = PLAN_IDS[plan];
      const subscription = await razorpay.subscriptions.create({
        plan_id: planId,
        customer_notify: 1,
        total_count: 12
      });

      business.subscriptionId = subscription.id;
      await business.save();

      return res.status(200).json({
        success: true,
        data: {
          subscription,
          keyId: process.env.RAZORPAY_KEY_ID
        },
        message: 'Subscription created successfully. Please complete payment.'
      });
    } catch (error: any) {
      console.error('Razorpay subscription creation error:', error);
      return res.status(500).json({
        success: false,
        data: null,
        message: error.message
      });
    }
  }
);

// POST /api/billing/cancel-subscription
router.post('/cancel-subscription', authMiddleware as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const business = await Business.findById(req.business?.id);
    if (!business) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Business profile not found.'
      });
    }

    if (!business.subscriptionId) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'No active subscription found.'
      });
    }

    if (process.env.MOCK_SERVICES === 'true' || !razorpay || business.subscriptionId.startsWith('sub_mock_')) {
      business.plan = 'free';
      business.subscriptionId = undefined;
      await business.save();

      const updated = business.toObject();
      delete (updated as any).passwordHash;

      return res.status(200).json({
        success: true,
        data: updated,
        message: 'Mock subscription cancelled successfully.'
      });
    }

    await razorpay.subscriptions.cancel(business.subscriptionId);
    business.plan = 'free';
    business.subscriptionId = undefined;
    await business.save();

    const updated = business.toObject();
    delete (updated as any).passwordHash;

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Subscription cancelled successfully.'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      data: null,
      message: error.message
    });
  }
});

// GET /api/billing/status
router.get('/status', authMiddleware as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.business?.id;
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Business profile not found.'
      });
    }

    // Usage stats: outbound messages count in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const messageCount = await Message.countDocuments({
      businessId,
      direction: 'outbound',
      createdAt: { $gte: thirtyDaysAgo }
    });

    const nextBillingDate = business.subscriptionId 
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Mock billing date (30 days from now)
      : null;

    return res.status(200).json({
      success: true,
      data: {
        plan: business.plan,
        subscriptionId: business.subscriptionId || null,
        trialEndsAt: business.trialEndsAt || null,
        nextBillingDate,
        usageStats: {
          outboundMessageCount30Days: messageCount
        }
      },
      message: 'Subscription status retrieved successfully.'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      data: null,
      message: error.message
    });
  }
});

// POST /api/billing/webhook — Razorpay Webhook
router.post('/webhook', async (req: any, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).send('No signature header found.');
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || 'your_razorpay_key_secret';
    
    // In mock mode, skip signature verification if header is 'mock_signature'
    if (process.env.MOCK_SERVICES === 'true' && signature === 'mock_signature') {
      console.log('[Billing Webhook] Skipping signature verification for mock signature.');
    } else {
      const shasum = crypto.createHmac('sha256', secret);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest('hex');

      if (digest !== signature) {
        console.warn('[Billing Webhook] Webhook signature verification failed.');
        return res.status(400).send('Invalid signature.');
      }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`[Billing Webhook] Received Razorpay Event: ${event}`);

    if (event === 'subscription.charged' || event === 'subscription.activated') {
      const subscription = payload.subscription.entity;
      const subscriptionId = subscription.id;
      const planId = subscription.plan_id;

      const business = await Business.findOne({ subscriptionId });
      if (business) {
        let targetPlan: 'starter' | 'pro' = 'starter';
        if (planId === PLAN_IDS.pro || planId === 'plan_pro_123') {
          targetPlan = 'pro';
        }

        business.plan = targetPlan;
        business.trialEndsAt = null; // Activation sets trialEndsAt to null
        await business.save();
        console.log(`[Billing Webhook] Business ${business.name} subscription active. Plan: ${targetPlan}`);
      } else {
        console.warn(`[Billing Webhook] No business found with subscription ID: ${subscriptionId}`);
      }
    } else if (event === 'subscription.cancelled' || event === 'subscription.halted') {
      const subscription = payload.subscription.entity;
      const subscriptionId = subscription.id;

      const business = await Business.findOne({ subscriptionId });
      if (business) {
        business.plan = 'free';
        business.subscriptionId = undefined;
        await business.save();
        console.log(`[Billing Webhook] Business ${business.name} subscription cancelled/halted. Downgraded to free.`);
      } else {
        console.warn(`[Billing Webhook] No business found with subscription ID: ${subscriptionId}`);
      }
    }

    return res.status(200).send('OK');
  } catch (error: any) {
    console.error('[Billing Webhook] Error processing event:', error);
    return res.status(500).send(error.message);
  }
});

export default router;
