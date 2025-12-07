# Test Suite Documentation

This directory contains comprehensive unit tests for all API endpoints following clean architecture principles and best practices.

## Test Structure

```
src/__tests__/
├── setup.ts                    # Global test setup and mocks
├── utils/
│   └── testHelpers.ts         # Test utilities and mock factories
└── routes/
    ├── authRoutes.test.ts     # Authentication endpoint tests
    ├── flashSaleRoutes.test.ts # Flash sale endpoint tests
    └── orderRoutes.test.ts    # Order endpoint tests
```

## Test Coverage

### Authentication Routes (`authRoutes.test.ts`)
- **POST /api/auth/login**
  - ✅ Successful login with valid credentials
  - ✅ Missing username validation
  - ✅ Missing password validation
  - ✅ Invalid credentials handling
  - ✅ Unexpected error handling

- **POST /api/auth/register**
  - ✅ Successful registration
  - ✅ Missing required fields validation
  - ✅ Invalid email format validation
  - ✅ Password length validation
  - ✅ Username conflict handling
  - ✅ Email conflict handling
  - ✅ Unexpected error handling

### Flash Sale Routes (`flashSaleRoutes.test.ts`)
- **GET /api/flash-sale/status**
  - ✅ Active flash sale status
  - ✅ Upcoming flash sale status
  - ✅ Ended flash sale status
  - ✅ Error handling

- **POST /api/flash-sale/attempt/:saleId**
  - ✅ Successful purchase attempt
  - ✅ Unauthenticated user handling
  - ✅ Missing saleId validation
  - ✅ Invalid saleId format validation
  - ✅ Flash sale not found
  - ✅ Flash sale not active
  - ✅ Out of stock handling
  - ✅ Already attempted handling
  - ✅ Error handling

### Order Routes (`orderRoutes.test.ts`)
- **GET /api/orders/status/:saleId**
  - ✅ Order found successfully
  - ✅ No order found (empty array)
  - ✅ Unauthenticated user handling
  - ✅ Missing saleId validation
  - ✅ Invalid saleId format validation
  - ✅ Error handling

## Testing Principles

### Clean Architecture
- **Dependency Injection**: All dependencies are mocked using interfaces
- **Separation of Concerns**: Tests focus on route handlers, not business logic
- **Single Responsibility**: Each test verifies one specific behavior

### Best Practices
1. **Isolation**: Each test is independent and doesn't rely on other tests
2. **Mocking**: External dependencies (services, repositories) are mocked
3. **Arrange-Act-Assert**: Clear test structure with setup, execution, and verification
4. **Edge Cases**: Tests cover validation, error cases, and boundary conditions
5. **Descriptive Names**: Test names clearly describe what is being tested

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Utilities

### `testHelpers.ts`
Provides reusable utilities for creating mocks:
- `createMockRequest()` - Creates mock Express Request objects
- `createMockResponse()` - Creates mock Express Response objects with spies
- `createMockAuthService()` - Creates mocked IAuthService
- `createMockFlashSaleService()` - Creates mocked IFlashSaleService
- `createMockOrderRepository()` - Creates mocked IOrderRepository

## Mock Strategy

All external dependencies are mocked to:
1. **Isolate** route handlers from business logic
2. **Control** return values and errors for testing different scenarios
3. **Verify** that services/repositories are called with correct parameters
4. **Speed up** tests by avoiding actual database/Redis/Kafka calls

## Future Enhancements

- Integration tests using supertest for full request/response flow
- Service layer unit tests
- Repository layer unit tests
- End-to-end tests with test database

