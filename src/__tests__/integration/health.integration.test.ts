import request from 'supertest';
import { createTestApp } from './setup';
import { TestAppContext } from './setup';

describe('Health Check Integration Tests', () => {
  let testContext: TestAppContext;

  beforeEach(() => {
    jest.clearAllMocks();
    testContext = createTestApp();
  });

  describe('GET /health', () => {
    it('should return health status without authentication', async () => {
      // Act
      const response = await request(testContext.app)
        .get('/health')
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.timestamp).toBe('string');
    });

    it('should return valid ISO timestamp', async () => {
      // Act
      const response = await request(testContext.app)
        .get('/health')
        .expect(200);

      // Assert
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });
});

