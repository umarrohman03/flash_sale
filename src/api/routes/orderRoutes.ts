import { Router, Request, Response } from 'express';
import { IRedisService } from '../../domain/interfaces/IRedisService';
import { logger } from '../../infrastructure/logger';

export function createOrderRoutes(
  redisService: IRedisService
): Router {
  const router = Router();

  /**
   * @swagger
   * /api/orders/status/{productId}:
   *   get:
   *     summary: Get order status by product ID and user ID from Redis
   *     description: Retrieve the authenticated user's purchase result for a specific product from Redis. The user ID is automatically extracted from the JWT token. Returns the purchase result (success/failure) stored in Redis cache. This endpoint reads directly from Redis without querying the database.
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   *         description: Product ID
   *         example: 1
   *     responses:
   *       200:
   *         description: Order status retrieved successfully from Redis
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     productId:
   *                       type: integer
   *                       example: 1
   *                     userId:
   *                       type: string
   *                       example: "2"
   *                     status:
   *                       type: string
   *                       enum: [SUCCESS, FAILED]
   *                       description: Purchase result status. SUCCESS if purchase was successful, FAILED if unsuccessful
   *                       example: "SUCCESS"
   *             examples:
   *               success:
   *                 value:
   *                   success: true
   *                   data:
   *                     productId: 1
   *                     userId: "2"
   *                     status: "SUCCESS"
   *               failed:
   *                 value:
   *                   success: true
   *                   data:
   *                     productId: 1
   *                     userId: "2"
   *                     status: "FAILED"
   *       400:
   *         description: Bad Request - Invalid product ID or order status not found in Redis
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *             examples:
   *               invalid_product_id:
   *                 value:
   *                   success: false
   *                   error: "Validation error"
   *                   message: "productId must be a positive integer"
   *               key_not_found:
   *                 value:
   *                   success: false
   *                   error: "Bad Request"
   *                   message: "Order status not found. The purchase attempt may not have been processed yet or the key does not exist in Redis."
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.get('/status/:productId', async (req: Request, res: Response) => {
    try {
      // Get userId from authenticated token (set by authMiddleware)
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required. Please provide a valid token.',
        });
      }

      const { productId } = req.params;

      if (!productId) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'productId parameter is required',
        });
      }

      const productIdNum = parseInt(productId, 10);
      if (isNaN(productIdNum) || productIdNum <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'productId must be a positive integer',
        });
      }

      const userId = req.user.userId;
      const productIdStr = String(productIdNum);

      // Get result from Redis: flashsale:result:{userId}:{productId}
      // Returns: true (success), false (failed), or null (key doesn't exist)
      const result = await redisService.getUserResult(userId, productIdStr);

      // If key doesn't exist in Redis, return 400 Bad Request
      if (result === null) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Order status not found. The purchase attempt may not have been processed yet or the key does not exist in Redis.',
        });
      }

      // Map Redis result to status string
      let status: string;
      if (result === true) {
        status = 'SUCCESS';
      } else {
        status = 'FAILED';
      }

      res.json({
        success: true,
        data: {
          productId: productIdNum,
          userId: userId,
          status: status,
        },
      });
    } catch (error: any) {
      logger.error('Error getting order status from Redis:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to retrieve order status',
      });
    }
  });

  return router;
}

