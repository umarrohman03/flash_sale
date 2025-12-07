# Integration Tests Documentation

This directory contains comprehensive integration tests for all API endpoints. Integration tests verify the complete request/response flow through the application, including middleware, routes, services, and error handling.

## Test Structure

```
src/__tests__/integration/
├── setup.ts                      # Test app setup and utilities
├── auth.integration.test.ts      # Authentication endpoint tests
├── flashSale.integration.test.ts # Flash sale endpoint tests
├── orders.integration.test.ts    # Order endpoint tests
└── health.integration.test.ts    # Health check endpoint tests
```

## Test Coverage

### Authentication Endpoints (`auth.integration.test.ts`)
- **POST /api/auth/register**
  - ✅ Successful registration
  - ✅ Missing required fields validation
  - ✅ Invalid email format validation
  - ✅ Username conflict handling

- **POST /api/auth/login**
  - ✅ Successful login with token generation
  - ✅ Missing credentials validation
  - ✅ Invalid credentials handling
  - ✅ Incorrect password handling

### Flash Sale Endpoints (`flashSale.integration.test.ts`)
- **GET /api/flash-sale/status**
  - ✅ Authenticated request with active flash sale
  - ✅ Unauthenticated request (401)
  - ✅ Invalid token (401)
  - ✅ Service error handling (500)

- **POST /api/flash-sale/attempt/:saleId**
  - ✅ Successful purchase attempt
  - ✅ Unauthenticated request (401)
  - ✅ Invalid saleId validation
  - ✅ Flash sale not found
  - ✅ Flash sale not active
  - ✅ Flash sale ended
  - ✅ Out of stock handling
  - ✅ Stock initialization when key doesn't exist

### Order Endpoints (`orders.integration.test.ts`)
- **GET /api/orders/status/:saleId**
  - ✅ Order found for user
  - ✅ No order found (empty array)
  - ✅ Unauthenticated request (401)
  - ✅ Invalid saleId validation
  - ✅ Repository error handling (500)
  - ✅ User isolation (users only see their own orders)

### Health Check Endpoint (`health.integration.test.ts`)
- **GET /health**
  - ✅ Health status without authentication
  - ✅ Valid ISO timestamp format

## Testing Principles

### Clean Architecture
- **Dependency Injection**: Services use mocked dependencies (Redis, Kafka, Database)
- **Real Services**: Business logic services (AuthService, FlashSaleService) use real implementations
- **Isolation**: Each test is independent with fresh mocks

### Best Practices
1. **Full Request/Response Flow**: Tests use supertest to make actual HTTP requests
2. **Authentication Testing**: Tests verify JWT token validation through middleware
3. **Error Scenarios**: Comprehensive coverage of validation, business logic, and system errors
4. **Date Mocking**: Uses `jest.useFakeTimers()` for time-dependent tests
5. **Descriptive Names**: Test names clearly describe the scenario being tested

## Test Utilities

### `setup.ts`
Provides utilities for creating test environments:
- `createTestApp()` - Creates Express app with mocked dependencies
- `createTestToken()` - Generates valid JWT tokens for testing
- `TestAppContext` - Type definition for test context

## Mock Strategy

Integration tests use a hybrid approach:
- **Mocked Infrastructure**: Redis, Kafka, Database repositories are mocked
- **Real Services**: Business logic services use real implementations with mocked dependencies
- **Real Middleware**: Authentication middleware uses real AuthService
- **Real Routes**: Express routes use real route handlers

This approach ensures:
1. Tests run fast (no real infrastructure needed)
2. Business logic is tested with real implementations
3. Integration points (middleware, routes) are verified
4. Error handling and validation are tested end-to-end

## Running Tests

```bash
# Run all integration tests
npm test -- src/__tests__/integration

# Run all tests (unit + integration)
npm test

# Run with coverage
npm run test:coverage
```

## Test Commands

```bash
npm test                    # Run all tests
npm test -- integration     # Run only integration tests
npm test -- routes          # Run only route unit tests
npm test -- services        # Run only service unit tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
```

## Differences from Unit Tests

| Aspect | Unit Tests | Integration Tests |
|--------|-----------|-------------------|
| **Scope** | Individual functions/methods | Full request/response flow |
| **HTTP** | Mock Express req/res | Real HTTP requests via supertest |
| **Middleware** | Not tested | Fully tested (auth, CORS, error handling) |
| **Services** | Mocked | Real implementations with mocked dependencies |
| **Speed** | Very fast | Fast (mocked infrastructure) |
| **Coverage** | Function-level | End-to-end flow |

## Future Enhancements

- Database integration tests with test database
- Redis integration tests with test Redis instance
- Kafka integration tests with test Kafka cluster
- End-to-end tests with full infrastructure
- Performance/load tests

