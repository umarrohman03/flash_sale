import { Request, Response, NextFunction } from 'express';
import { IAuthService } from '../../domain/interfaces/IAuthService';
import { logger } from '../../infrastructure/logger';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
      };
    }
  }
}

export function createAuthMiddleware(authService: IAuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'No token provided. Please include a Bearer token in the Authorization header.',
        });
      }

      // Extract token
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify token
      const decoded = await authService.verifyToken(token);
      
      // Attach user info to request
      req.user = decoded;
      
      next();
    } catch (error: any) {
      logger.warn('Authentication failed:', error.message);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: error.message || 'Invalid or expired token',
      });
    }
  };
}

