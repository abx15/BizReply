import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Business } from '../models/Business';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { validateRequest } from '../middleware/validate';

const router = Router();

// GET /api/conversations
router.get(
  '/',
  authMiddleware as any,
  [
    query('status').optional().isIn(['active', 'resolved', 'needs_attention']).withMessage('Invalid status filter')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business?.id;
      const { status } = req.query;

      const filter: any = { businessId };
      if (status) {
        filter.status = status;
      }

      const conversations = await Conversation.find(filter).sort({ lastMessageAt: -1 });
      
      return res.status(200).json({
        success: true,
        data: conversations,
        message: 'Conversations retrieved successfully.'
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

// GET /api/conversations/:id/messages
router.get(
  '/:id/messages',
  authMiddleware as any,
  [
    param('id').isMongoId().withMessage('Invalid conversation ID')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business?.id;
      const conversationId = req.params.id;

      const conversation = await Conversation.findOne({ _id: conversationId, businessId });
      if (!conversation) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Conversation not found.'
        });
      }

      const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });
      
      return res.status(200).json({
        success: true,
        data: {
          conversation,
          messages
        },
        message: 'Conversation messages retrieved successfully.'
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

// POST /api/conversations/:id/messages
router.post(
  '/:id/messages',
  authMiddleware as any,
  [
    param('id').isMongoId().withMessage('Invalid conversation ID'),
    body('content').isString().trim().notEmpty().withMessage('Message content is required.')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business?.id;
      const conversationId = req.params.id;
      const { content } = req.body;

      const conversation = await Conversation.findOne({ _id: conversationId, businessId });
      if (!conversation) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Conversation not found.'
        });
      }

      const business = await Business.findById(businessId);
      if (!business) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Business profile not found.'
        });
      }

      // Automatically pause AI on manual owner message
      conversation.isAiPaused = true;
      conversation.status = 'active'; 
      conversation.lastMessageAt = new Date();
      await conversation.save();

      const whatsappMsgId = await sendWhatsAppMessage(conversation.customerPhone, content, business);

      const outboundMessage = new Message({
        conversationId: conversation._id,
        businessId: business._id,
        direction: 'outbound',
        content,
        handledBy: 'owner',
        whatsappMsgId
      });
      await outboundMessage.save();

      const io = req.app.get('io');
      if (io) {
        io.to(business._id.toString()).emit('newMessage', {
          conversation,
          message: outboundMessage
        });
      }

      return res.status(201).json({
        success: true,
        data: outboundMessage,
        message: 'Message sent and logged successfully.'
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

// PUT /api/conversations/:id/status
router.put(
  '/:id/status',
  authMiddleware as any,
  [
    param('id').isMongoId().withMessage('Invalid conversation ID'),
    body('status').isIn(['active', 'resolved', 'needs_attention']).withMessage('Invalid status value.')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business?.id;
      const { status } = req.body;

      const conversation = await Conversation.findOneAndUpdate(
        { _id: req.params.id, businessId },
        { status },
        { new: true }
      );

      if (!conversation) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Conversation not found.'
        });
      }

      const io = req.app.get('io');
      if (io) {
        io.to(businessId!).emit('conversationStatusChanged', conversation);
      }

      return res.status(200).json({
        success: true,
        data: conversation,
        message: 'Conversation status updated successfully.'
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

// PUT /api/conversations/:id/toggle-ai
router.put(
  '/:id/toggle-ai',
  authMiddleware as any,
  [
    param('id').isMongoId().withMessage('Invalid conversation ID'),
    body('isAiPaused').isBoolean().withMessage('isAiPaused state must be a boolean value.')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business?.id;
      const { isAiPaused } = req.body;

      const conversation = await Conversation.findOneAndUpdate(
        { _id: req.params.id, businessId },
        { isAiPaused },
        { new: true }
      );

      if (!conversation) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Conversation not found.'
        });
      }

      const io = req.app.get('io');
      if (io) {
        io.to(businessId!).emit('conversationStatusChanged', conversation);
      }

      return res.status(200).json({
        success: true,
        data: conversation,
        message: 'AI paused status updated successfully.'
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

export default router;
