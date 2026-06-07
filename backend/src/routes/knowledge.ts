import { Router, Response } from 'express';
import multer from 'multer';
import { body, param } from 'express-validator';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { parseExcelFile } from '../services/excel';
import { KnowledgeItem } from '../models/KnowledgeItem';
import { validateRequest } from '../middleware/validate';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/knowledge/upload
router.post(
  '/upload',
  authMiddleware as any,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Please upload an Excel file.'
        });
      }

      const businessId = req.business?.id;
      if (!businessId) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Unauthorized: Business ID missing.'
        });
      }

      const items = parseExcelFile(req.file.buffer, businessId);

      await KnowledgeItem.deleteMany({ businessId });
      const saved = await KnowledgeItem.insertMany(items);

      return res.status(200).json({
        success: true,
        data: {
          count: saved.length,
          items: saved
        },
        message: `Successfully uploaded and parsed ${saved.length} knowledge items.`
      });
    } catch (error: any) {
      console.error('Upload Error:', error);
      return res.status(500).json({
        success: false,
        data: null,
        message: error.message
      });
    }
  }
);

// GET /api/knowledge
router.get('/', authMiddleware as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const items = await KnowledgeItem.find({ businessId: req.business?.id }).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: items,
      message: 'Knowledge items retrieved successfully.'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      data: null,
      message: error.message
    });
  }
});

// POST /api/knowledge
router.post(
  '/',
  authMiddleware as any,
  [
    body('name').isString().trim().notEmpty().withMessage('Item name/question is required'),
    body('type').isIn(['service', 'product', 'faq', 'policy']).withMessage('Invalid type (must be service, product, faq, or policy)'),
    body('price').optional({ checkFalsy: true }).isNumeric().withMessage('Price must be a number'),
    body('duration').optional().isString().trim(),
    body('notes').optional().isString().trim()
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type, name, price, duration, notes } = req.body;

      const item = new KnowledgeItem({
        businessId: req.business?.id,
        type,
        name,
        price: price ? parseFloat(price) : undefined,
        duration,
        notes
      });

      await item.save();
      
      return res.status(201).json({
        success: true,
        data: item,
        message: 'Knowledge item created successfully.'
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

// PUT /api/knowledge/:id
router.put(
  '/:id',
  authMiddleware as any,
  [
    param('id').isMongoId().withMessage('Invalid item ID'),
    body('name').optional().isString().trim().notEmpty().withMessage('Item name/question cannot be empty'),
    body('type').optional().isIn(['service', 'product', 'faq', 'policy']).withMessage('Invalid type'),
    body('price').optional({ checkFalsy: true }).isNumeric().withMessage('Price must be a number'),
    body('duration').optional().isString().trim(),
    body('notes').optional().isString().trim()
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type, name, price, duration, notes } = req.body;
      const updateData: any = {};
      if (type !== undefined) updateData.type = type;
      if (name !== undefined) updateData.name = name;
      if (price !== undefined) updateData.price = price ? parseFloat(price) : null;
      if (duration !== undefined) updateData.duration = duration;
      if (notes !== undefined) updateData.notes = notes;

      const item = await KnowledgeItem.findOneAndUpdate(
        { _id: req.params.id, businessId: req.business?.id },
        updateData,
        { new: true }
      );

      if (!item) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Knowledge item not found.'
        });
      }

      return res.status(200).json({
        success: true,
        data: item,
        message: 'Knowledge item updated successfully.'
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

// DELETE /api/knowledge/:id
router.delete(
  '/:id',
  authMiddleware as any,
  [
    param('id').isMongoId().withMessage('Invalid item ID')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const item = await KnowledgeItem.findOneAndDelete({
        _id: req.params.id,
        businessId: req.business?.id
      });

      if (!item) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Knowledge item not found.'
        });
      }

      return res.status(200).json({
        success: true,
        data: null,
        message: 'Knowledge item deleted successfully.'
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
