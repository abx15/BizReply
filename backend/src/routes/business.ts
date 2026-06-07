import { Router, Response } from 'express';
import { body } from 'express-validator';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { Business } from '../models/Business';

const router = Router();

// GET /api/business/me
router.get('/me', authMiddleware as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.business?.id;
    const business = await Business.findById(businessId).select('-passwordHash');
    if (!business) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Business profile not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: business,
      message: 'Business profile retrieved successfully.'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      data: null,
      message: error.message
    });
  }
});

// PUT /api/business/update
router.put(
  '/update',
  authMiddleware as any,
  [
    body('name').optional().isString().trim().notEmpty().withMessage('Name cannot be empty'),
    body('whatsappNumber').optional().isString().trim(),
    body('whatsappToken').optional().isString().trim(),
    body('whatsappPhoneId').optional().isString().trim(),
    body('businessHours').optional().isObject().withMessage('Business hours must be an object'),
    body('businessHours.open').optional().isString().matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Open time must be in HH:MM format (e.g. 09:00)'),
    body('businessHours.close').optional().isString().matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Close time must be in HH:MM format (e.g. 18:00)'),
    body('businessHours.days').optional().isArray().withMessage('Days must be an array of numbers'),
    body('businessHours.days.*').optional().isInt({ min: 0, max: 6 }).withMessage('Days must be integers between 0 (Sunday) and 6 (Saturday)'),
    body('aiEnabled').optional().isBoolean().withMessage('aiEnabled must be a boolean')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const businessId = req.business?.id;
      const { name, whatsappNumber, whatsappToken, whatsappPhoneId, businessHours, aiEnabled } = req.body;

      const business = await Business.findById(businessId);
      if (!business) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Business profile not found.'
        });
      }

      if (name !== undefined) business.name = name;
      if (whatsappNumber !== undefined) business.whatsappNumber = whatsappNumber;
      if (whatsappToken !== undefined) business.whatsappToken = whatsappToken;
      if (whatsappPhoneId !== undefined) business.whatsappPhoneId = whatsappPhoneId;
      
      if (businessHours) {
        if (businessHours.open !== undefined) business.businessHours.open = businessHours.open;
        if (businessHours.close !== undefined) business.businessHours.close = businessHours.close;
        if (businessHours.days !== undefined) business.businessHours.days = businessHours.days;
      }
      
      if (aiEnabled !== undefined) business.aiEnabled = aiEnabled;

      await business.save();

      const updated = business.toObject();
      delete (updated as any).passwordHash;

      return res.status(200).json({
        success: true,
        data: updated,
        message: 'Business settings updated successfully.'
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
