// Global test setup
// This file runs before all tests

// Mock logger to avoid console noise during tests
jest.mock('../infrastructure/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

