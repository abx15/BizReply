import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { Business } from '../models/Business';

const PLAN_HIERARCHY: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2
};

export function checkPlan(requiredPlan: 'free' | 'starter' | 'pro') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = req.business?.id;
      if (!businessId) {
        return res.status(401).json({
          success: false,
          data: null,
          message: 'Unauthorized: Business ID missing.'
        });
      }

      const business = await Business.findById(businessId);
      if (!business) {
        return res.status(404).json({
          success: false,
          data: null,
          message: 'Business not found.'
        });
      }

      // Check if trial has ended
      const isTrialEnded = business.plan === 'free' && 
        (business.trialEndsAt ? new Date() > new Date(business.trialEndsAt) : true);
      const currentPlanLevel = isTrialEnded ? -1 : PLAN_HIERARCHY[business.plan] ?? 0;
      const requiredPlanLevel = PLAN_HIERARCHY[requiredPlan] ?? 0;

      if (currentPlanLevel < requiredPlanLevel) {
        const upgradeMsg = isTrialEnded 
          ? 'Your free trial has expired. Please upgrade your plan to access this feature.'
          : `This feature requires the ${requiredPlan.toUpperCase()} plan. Please upgrade to access.`;

        return res.status(403).json({
          success: false,
          data: null,
          message: upgradeMsg
        });
      }

      // Attach the full business document to request for convenience in later handlers
      req.business = {
        id: business._id.toString(),
        email: business.email,
        name: business.name,
        // Optional properties from IBusiness can be extended if needed
      } as any;
      
      next();
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        data: null,
        message: error.message
      });
    }
  };
}
