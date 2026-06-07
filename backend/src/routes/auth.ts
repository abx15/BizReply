import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import { Business } from '../models/Business';
import { validateRequest } from '../middleware/validate';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_token_for_bizreply_platform';

// POST /api/auth/signup
router.post(
  '/signup',
  [
    body('name').isString().trim().notEmpty().withMessage('Business name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('phone').isString().trim().notEmpty().withMessage('Phone number is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
  ],
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const { name, phone, email, password } = req.body;

      const existing = await Business.findOne({ $or: [{ email }, { phone }] });
      if (existing) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Business with this email or phone already exists.'
        });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const business = new Business({
        name,
        phone,
        email,
        passwordHash,
        plan: 'free',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      await business.save();

      const token = jwt.sign(
        { id: business._id, email: business.email, name: business.name },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.status(201).json({
        success: true,
        data: {
          token,
          business: {
            id: business._id,
            name: business.name,
            email: business.email,
            phone: business.phone,
            plan: business.plan,
            trialEndsAt: business.trialEndsAt
          }
        },
        message: 'Business registered successfully.'
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

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const { email, password } = req.body;

      const business = await Business.findOne({ email });
      if (!business) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Invalid credentials.'
        });
      }

      const isMatch = await bcrypt.compare(password, business.passwordHash);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Invalid credentials.'
        });
      }

      const token = jwt.sign(
        { id: business._id, email: business.email, name: business.name },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.status(200).json({
        success: true,
        data: {
          token,
          business: {
            id: business._id,
            name: business.name,
            email: business.email,
            phone: business.phone,
            plan: business.plan,
            trialEndsAt: business.trialEndsAt,
            whatsappNumber: business.whatsappNumber,
            whatsappPhoneId: business.whatsappPhoneId,
            aiEnabled: business.aiEnabled
          }
        },
        message: 'Login successful.'
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

// POST /api/auth/logout
router.post('/logout', async (req: any, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      data: null,
      message: 'Logout successful.'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      data: null,
      message: error.message
    });
  }
});

export default router;
