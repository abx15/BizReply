import { Router, Response } from 'express';
import { body } from 'express-validator';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { checkPlan } from '../middleware/planGate';
import { Conversation } from '../models/Conversation';
import { Business } from '../models/Business';
import { Campaign } from '../models/Campaign';
import { broadcastQueue } from '../services/queue';
import { validateRequest } from '../middleware/validate';
import cron from 'node-cron';

const router = Router();

// POST /api/broadcast/send — accept { message, scheduleAt? }
router.post(
  '/send',
  authMiddleware as any,
  checkPlan('pro') as any, // Protect with pro plan gate
  [
    body('message').isString().trim().notEmpty().withMessage('Broadcast message content is required.'),
    body('scheduleAt').optional().isISO8601().withMessage('scheduleAt must be a valid ISO8601 date string.')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business?.id;
      const { message, scheduleAt } = req.body;

      const business = await Business.findById(businessId);
      if (!business) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Business profile not found.'
        });
      }

      // Fetch all unique customer phones from Conversations for this business
      const conversations = await Conversation.find({ businessId }).select('customerPhone');
      const uniquePhones = Array.from(new Set(conversations.map(c => c.customerPhone)));

      if (uniquePhones.length === 0) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'No contacts found to broadcast to. You must have existing conversations.'
        });
      }

      const campaignName = `Broadcast_${Date.now()}`;

      if (scheduleAt) {
        const scheduleDate = new Date(scheduleAt);
        if (scheduleDate <= new Date()) {
          return res.status(400).json({
            success: false,
            data: null,
            message: 'Scheduled date must be in the future.'
          });
        }

        const campaign = new Campaign({
          businessId,
          name: campaignName,
          content: message,
          targets: uniquePhones,
          status: 'pending',
          scheduledAt: scheduleDate
        });
        await campaign.save();

        return res.status(201).json({
          success: true,
          data: campaign,
          message: 'Broadcast campaign scheduled successfully.'
        });
      } else {
        // Immediate send
        const campaign = new Campaign({
          businessId,
          name: campaignName,
          content: message,
          targets: uniquePhones,
          status: 'completed',
          scheduledAt: new Date()
        });
        await campaign.save();

        // Add to Queue
        for (const phone of uniquePhones) {
          await broadcastQueue.addJob(phone, message, business);
        }

        return res.status(201).json({
          success: true,
          data: campaign,
          message: `Broadcast queued successfully for ${uniquePhones.length} contacts.`
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        data: null,
        message: error.message
      });
    }
  }
);

// GET /api/broadcast/history — list past broadcasts with delivered count
router.get(
  '/history',
  authMiddleware as any,
  checkPlan('pro') as any, // Protect with pro plan gate
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business?.id;
      const campaigns = await Campaign.find({ businessId }).sort({ createdAt: -1 });

      // Map to add deliveredCount
      const historyData = campaigns.map(c => {
        const campaignObj = c.toObject();
        return {
          ...campaignObj,
          deliveredCount: c.status === 'completed' ? c.targets.length : 0
        };
      });

      return res.status(200).json({
        success: true,
        data: historyData,
        message: 'Broadcast history retrieved successfully.'
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        data: null,
        message: error.message
      });
    }
  }
);

// Cron task for scheduled broadcasts (runs every minute)
export function initBroadcastCron() {
  cron.schedule('*/1 * * * *', async () => {
    try {
      const now = new Date();
      const pendingCampaigns = await Campaign.find({
        status: 'pending',
        scheduledAt: { $lte: now }
      });

      if (pendingCampaigns.length === 0) return;

      console.log(`[Cron] Found ${pendingCampaigns.length} scheduled broadcasts to process.`);

      for (const campaign of pendingCampaigns) {
        campaign.status = 'processing';
        await campaign.save();

        const business = await Business.findById(campaign.businessId);
        if (!business) {
          campaign.status = 'failed';
          await campaign.save();
          continue;
        }

        for (const phone of campaign.targets) {
          await broadcastQueue.addJob(phone, campaign.content, business);
        }

        campaign.status = 'completed';
        await campaign.save();
        console.log(`[Cron] Successfully processed scheduled broadcast: ${campaign.name}`);
      }
    } catch (error) {
      console.error('[Cron] Error running scheduled campaign task:', error);
    }
  });
  console.log('[Cron] Broadcast scheduler service initialized.');
}

export default router;
