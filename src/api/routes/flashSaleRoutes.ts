import { Router, Request, Response } from 'express';
import { IFlashSaleService } from '../../domain/interfaces/IFlashSaleService';
import { logger } from '../../infrastructure/logger';

export function createFlashSaleRoutes(flashSaleService: IFlashSaleService): Router {
  const router = Router();

  /**
   * @swagger
   * /api/flash-sale/status:
   *   get:
   *     summary: Get flash sale status
   *     description: Check the current status of the flash sale (upcoming, active, ended)
   *     tags: [Flash Sale]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Flash sale status retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StatusResponse'
   *             example:
   *               success: true
   *               data:
   *                 id: 1
   *                 status: active
   *                 startTime: "2024-01-01T00:00:00.000Z"
   *                 endTime: "2024-01-01T23:59:59.000Z"
   *                 currentTime: "2024-01-01T12:00:00.000Z"
   *                 productName: "Premium Smartphone"
   *                 productDescription: "Latest model smartphone with advanced features"
   *                 productId: 1
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const status = await flashSaleService.getStatus();
      res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      logger.error('Error getting flash sale status:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to get flash sale status',
      });
    }
  });

  /**
   * @swagger
   * /api/flash-sale/attempt/{saleId}:
   *   post:
   *     summary: Attempt to purchase an item
   *     description: User attempts to purchase an item from a specific flash sale. The user ID is automatically extracted from the JWT token. This operation is atomic and prevents race conditions.
   *     tags: [Flash Sale]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: saleId
   *         required: true
   *         schema:
   *           type: integer
   *         description: Flash sale ID
   *         example: 1
   *     responses:
   *       200:
   *         description: Purchase attempt successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AttemptPurchaseResponse'
   *             example:
   *               success: true
   *               message: "Your purchase attempt has been received and is being processed."
   *       400:
   *         description: Purchase attempt failed or validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AttemptPurchaseResponse'
   *             examples:
   *               flashSaleNotFound:
   *                 value:
   *                   success: false
   *                   message: "Flash sale with ID 1 not found."
   *               flashSaleNotActive:
   *                 value:
   *                   success: false
   *                   message: "Flash sale is not yet active. Start time: 2024-01-01T00:00:00.000Z"
   *               flashSaleEnded:
   *                 value:
   *                   success: false
   *                   message: "Flash sale has ended. End time: 2024-01-01T23:59:59.000Z"
   *               outOfStock:
   *                 value:
   *                   success: false
   *                   message: "Sorry, the item is out of stock."
   *               alreadyAttempted:
   *                 value:
   *                   success: false
   *                   message: "Your purchase attempt is being processed. Please check back shortly."
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.post('/attempt/:saleId', async (req: Request, res: Response) => {
    try {
      // Get userId from authenticated token (set by authMiddleware)
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required. Please provide a valid token.',
        });
      }

      // Get saleId from path parameter
      const { saleId } = req.params;
      if (!saleId) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'saleId parameter is required',
        });
      }

      const saleIdNum = parseInt(saleId, 10);
      if (isNaN(saleIdNum) || saleIdNum <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'saleId must be a positive integer',
        });
      }

      const userId = req.user.userId;
      const result = await flashSaleService.attemptPurchase(userId, saleIdNum);

      // Return appropriate status code based on result
      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json({
        success: result.success,
        message: result.message,
      });
    } catch (error: any) {
      logger.error('Error processing purchase attempt:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to process purchase attempt',
      });
    }
  });

  return router;
}

