/**
 * Stress Test Script for Flash Sale System
 * 
 * This script simulates high-volume concurrent purchase attempts to:
 * 1. Test system performance under load
 * 2. Verify concurrency control (no overselling)
 * 3. Measure response times and success rates
 * 4. Validate system stability
 * 
 * Usage:
 *   npm run stress-test
 * 
 * Configuration:
 *   - Set STRESS_TEST_USERS in .env (default: 100)
 *   - Set STRESS_TEST_CONCURRENT in .env (default: 50)
 *   - Set API_BASE_URL in .env (default: http://localhost:3001)
 */

import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';
import { performance } from 'perf_hooks';

// Load environment variables
dotenv.config({ override: false });

interface TestConfig {
  apiBaseUrl: string;
  totalUsers: number;
  concurrentUsers: number;
  saleId: number;
  testUserPrefix: string;
}

interface TestResult {
  userId: string;
  success: boolean;
  statusCode: number;
  responseTime: number;
  message?: string;
  error?: string;
}

interface TestSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errors: Map<string, number>;
  statusCodes: Map<number, number>;
}

class StressTestRunner {
  private config: TestConfig;
  private results: TestResult[] = [];
  private startTime: number = 0;
  private endTime: number = 0;

  constructor(config: TestConfig) {
    this.config = config;
  }

  /**
   * Create a test user and get authentication token
   */
  private async createTestUser(userId: string): Promise<string | null> {
    try {
      const username = `${this.config.testUserPrefix}${userId}`;
      const email = `${username}@stress-test.com`;
      const password = 'stress-test-password';

      // Try to register the user
      try {
        await axios.post(`${this.config.apiBaseUrl}/api/auth/register`, {
          username,
          email,
          password,
          fullName: `Stress Test User ${userId}`,
        }, {
          timeout: 10000, // 10 second timeout
        });
      } catch (error: any) {
        // User might already exist (409 Conflict), continue to login
        if (error.response?.status === 409) {
          // User already exists, that's fine, we'll login instead
        } else if (error.response) {
          // Other HTTP error - log details
          const status = error.response.status;
          const message = error.response.data?.message || error.message;
          console.error(`Failed to register user ${userId}: HTTP ${status} - ${message}`);
          // Still try to login in case user exists
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          // Connection error
          console.error(`Failed to connect to API for user ${userId}: ${error.code} - ${error.message}`);
          return null;
        } else {
          // Other error
          console.error(`Failed to register user ${userId}: ${error.message || JSON.stringify(error)}`);
          // Still try to login in case user exists
        }
      }

      // Login to get token
      try {
        const loginResponse = await axios.post(`${this.config.apiBaseUrl}/api/auth/login`, {
          username,
          password,
        }, {
          timeout: 10000, // 10 second timeout
        });

        if (!loginResponse.data?.data?.token) {
          console.error(`Login response missing token for user ${userId}`);
          return null;
        }

        return loginResponse.data.data.token;
      } catch (error: any) {
        if (error.response) {
          const status = error.response.status;
          const message = error.response.data?.message || error.message;
          console.error(`Failed to login user ${userId}: HTTP ${status} - ${message}`);
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          console.error(`Failed to connect to API for login user ${userId}: ${error.code} - ${error.message}`);
        } else {
          console.error(`Failed to login user ${userId}: ${error.message || JSON.stringify(error)}`);
        }
        return null;
      }
    } catch (error: any) {
      // Fallback error handler
      const errorMessage = error.response?.data?.message || error.message || JSON.stringify(error);
      console.error(`Failed to create/login user ${userId}: ${errorMessage}`);
      if (error.response) {
        console.error(`  Status: ${error.response.status}`);
        console.error(`  Data: ${JSON.stringify(error.response.data)}`);
      }
      return null;
    }
  }

  /**
   * Simulate a single purchase attempt
   */
  private async attemptPurchase(userId: string, token: string): Promise<TestResult> {
    const startTime = performance.now();
    
    try {
      const response = await axios.post(
        `${this.config.apiBaseUrl}/api/flash-sale/attempt/${this.config.saleId}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      const responseTime = performance.now() - startTime;

      return {
        userId,
        success: response.data.success === true,
        statusCode: response.status,
        responseTime,
        message: response.data.message,
      };
    } catch (error: any) {
      const responseTime = performance.now() - startTime;
      const statusCode = error.response?.status || 0;
      const errorMessage = error.response?.data?.message || error.message;

      return {
        userId,
        success: false,
        statusCode,
        responseTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Run a batch of concurrent purchase attempts
   */
  private async runBatch(userIds: string[], tokens: Map<string, string>): Promise<void> {
    const promises = userIds.map(async (userId) => {
      const token = tokens.get(userId);
      if (!token) {
        this.results.push({
          userId,
          success: false,
          statusCode: 0,
          responseTime: 0,
          error: 'No authentication token',
        });
        return;
      }

      const result = await this.attemptPurchase(userId, token);
      this.results.push(result);
    });

    await Promise.all(promises);
  }

  /**
   * Run the stress test
   */
  async run(): Promise<TestSummary> {
    console.log('\n🚀 Starting Stress Test...');
    console.log('=' .repeat(60));
    console.log(`Configuration:`);
    console.log(`  - API Base URL: ${this.config.apiBaseUrl}`);
    console.log(`  - Total Users: ${this.config.totalUsers}`);
    console.log(`  - Concurrent Users: ${this.config.concurrentUsers}`);
    console.log(`  - Sale ID: ${this.config.saleId}`);
    console.log('=' .repeat(60));

    this.startTime = performance.now();

    // Step 1: Create test users and get tokens
    console.log('\n📝 Step 1: Creating test users and obtaining tokens...');
    const tokens = new Map<string, string>();
    const userIds: string[] = [];

    for (let i = 1; i <= this.config.totalUsers; i++) {
      userIds.push(String(i));
    }

    // Create users in batches to avoid overwhelming the system
    const userBatchSize = 10;
    for (let i = 0; i < userIds.length; i += userBatchSize) {
      const batch = userIds.slice(i, i + userBatchSize);
      const batchPromises = batch.map(async (userId) => {
        const token = await this.createTestUser(userId);
        if (token) {
          tokens.set(userId, token);
        }
      });
      await Promise.all(batchPromises);
      process.stdout.write(`\r  Created ${Math.min(i + userBatchSize, userIds.length)}/${userIds.length} users...`);
    }
    console.log(`\n  ✓ Created ${tokens.size} users with valid tokens`);

    if (tokens.size === 0) {
      throw new Error('Failed to create any test users');
    }

    // Step 2: Run concurrent purchase attempts
    console.log('\n🛒 Step 2: Running concurrent purchase attempts...');
    const validUserIds = Array.from(tokens.keys());
    
    // Run in batches of concurrent users
    for (let i = 0; i < validUserIds.length; i += this.config.concurrentUsers) {
      const batch = validUserIds.slice(i, i + this.config.concurrentUsers);
      await this.runBatch(batch, tokens);
      process.stdout.write(`\r  Processed ${Math.min(i + this.config.concurrentUsers, validUserIds.length)}/${validUserIds.length} requests...`);
    }
    console.log(`\n  ✓ Completed ${this.results.length} purchase attempts`);

    this.endTime = performance.now();

    // Step 3: Analyze results
    console.log('\n📊 Step 3: Analyzing results...');
    const summary = this.analyzeResults();
    this.printSummary(summary);

    return summary;
  }

  /**
   * Analyze test results and generate summary
   */
  private analyzeResults(): TestSummary {
    const totalRequests = this.results.length;
    const successfulRequests = this.results.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const successRate = (successfulRequests / totalRequests) * 100;

    const responseTimes = this.results.map(r => r.responseTime).sort((a, b) => a - b);
    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = responseTimes[0] || 0;
    const maxResponseTime = responseTimes[responseTimes.length - 1] || 0;
    const p50ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.5)] || 0;
    const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
    const p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;

    const errors = new Map<string, number>();
    const statusCodes = new Map<number, number>();

    this.results.forEach(result => {
      // Count status codes
      const statusCount = statusCodes.get(result.statusCode) || 0;
      statusCodes.set(result.statusCode, statusCount + 1);

      // Count errors
      if (result.error) {
        const errorCount = errors.get(result.error) || 0;
        errors.set(result.error, errorCount + 1);
      }
    });

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate,
      averageResponseTime,
      minResponseTime,
      maxResponseTime,
      p50ResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      errors,
      statusCodes,
    };
  }

  /**
   * Print test summary
   */
  private printSummary(summary: TestSummary): void {
    const totalTime = (this.endTime - this.startTime) / 1000; // Convert to seconds
    const requestsPerSecond = summary.totalRequests / totalTime;

    console.log('\n' + '='.repeat(60));
    console.log('📈 STRESS TEST RESULTS');
    console.log('='.repeat(60));
    
    console.log('\n📊 Request Statistics:');
    console.log(`  Total Requests:        ${summary.totalRequests}`);
    console.log(`  Successful Requests:   ${summary.successfulRequests} (${summary.successRate.toFixed(2)}%)`);
    console.log(`  Failed Requests:       ${summary.failedRequests} (${(100 - summary.successRate).toFixed(2)}%)`);
    
    console.log('\n⏱️  Performance Metrics:');
    console.log(`  Total Test Duration:   ${totalTime.toFixed(2)}s`);
    console.log(`  Requests per Second:   ${requestsPerSecond.toFixed(2)} req/s`);
    console.log(`  Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms`);
    console.log(`  Min Response Time:     ${summary.minResponseTime.toFixed(2)}ms`);
    console.log(`  Max Response Time:     ${summary.maxResponseTime.toFixed(2)}ms`);
    console.log(`  P50 (Median):          ${summary.p50ResponseTime.toFixed(2)}ms`);
    console.log(`  P95:                  ${summary.p95ResponseTime.toFixed(2)}ms`);
    console.log(`  P99:                  ${summary.p99ResponseTime.toFixed(2)}ms`);

    if (summary.statusCodes.size > 0) {
      console.log('\n📋 Status Code Distribution:');
      Array.from(summary.statusCodes.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([code, count]) => {
          const percentage = (count / summary.totalRequests) * 100;
          console.log(`  ${code}: ${count} (${percentage.toFixed(2)}%)`);
        });
    }

    if (summary.errors.size > 0) {
      console.log('\n❌ Error Distribution:');
      Array.from(summary.errors.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10) // Show top 10 errors
        .forEach(([error, count]) => {
          const percentage = (count / summary.totalRequests) * 100;
          console.log(`  "${error}": ${count} (${percentage.toFixed(2)}%)`);
        });
    }

    console.log('\n' + '='.repeat(60));
    
    // Concurrency control validation
    console.log('\n🔒 Concurrency Control Validation:');
    const successMessages = this.results
      .filter(r => r.success && r.message)
      .map(r => r.message!);
    
    const outOfStockCount = successMessages.filter(m => 
      m.toLowerCase().includes('out of stock') || 
      m.toLowerCase().includes('stock')
    ).length;
    
    const processingCount = successMessages.filter(m => 
      m.toLowerCase().includes('processing') || 
      m.toLowerCase().includes('received')
    ).length;

    console.log(`  Purchase attempts received: ${processingCount}`);
    console.log(`  Out of stock responses:     ${outOfStockCount}`);
    console.log(`  Note: Check database to verify no overselling occurred`);
    console.log(`        Expected: Only ${this.config.saleId} successful orders (based on stock)`);
    
    console.log('\n' + '='.repeat(60));
  }
}

// Main execution
async function main() {
  const config: TestConfig = {
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
    totalUsers: parseInt(process.env.STRESS_TEST_USERS || '100', 10),
    concurrentUsers: parseInt(process.env.STRESS_TEST_CONCURRENT || '50', 10),
    saleId: parseInt(process.env.STRESS_TEST_SALE_ID || '1', 10),
    testUserPrefix: process.env.STRESS_TEST_USER_PREFIX || 'stresstest',
  };

  try {
    const runner = new StressTestRunner(config);
    await runner.run();
    
    console.log('\n✅ Stress test completed successfully!');
    console.log('\n💡 Next Steps:');
    console.log('  1. Check the database to verify order count matches stock');
    console.log('  2. Verify no overselling occurred (orders <= initial stock)');
    console.log('  3. Check Redis stock value matches remaining stock');
    console.log('  4. Review logs for any errors or warnings');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Stress test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { StressTestRunner, TestConfig, TestResult, TestSummary };

