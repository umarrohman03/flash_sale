// Redis Lua scripts for atomic operations
// These scripts ensure atomicity and prevent race conditions

/**
 * Attempt Purchase Script
 * Atomically:
 * 1. Check if user already attempted
 * 2. Check and decrement stock if available
 * 3. Add user to attempted set
 * 
 * Returns: [success: 1/0, remainingStock: number, wasNewAttempt: 1/0]
 * - success: 1 if stock was available and decremented, 0 if out of stock or already attempted
 * - remainingStock: remaining stock after decrement (or -1 if failed)
 * - wasNewAttempt: 1 if user was added to set (new attempt), 0 if already existed
 */
export const ATTEMPT_PURCHASE_SCRIPT = `
  local stockKey = KEYS[1]
  local attemptedSetKey = KEYS[2]
  local userId = ARGV[1]
  
  -- Check if user already attempted
  local isMember = redis.call('SISMEMBER', attemptedSetKey, userId)
  if isMember == 1 then
    -- User already attempted
    local currentStock = redis.call('GET', stockKey) or '0'
    redis.log(redis.LOG_NOTICE, string.format('[ATTEMPT_PURCHASE] User %s already attempted. Current stock: %s', userId, currentStock))
    return {0, tonumber(currentStock), 0}
  end
  
  -- Get current stock
  local stock = tonumber(redis.call('GET', stockKey) or '0')
  redis.log(redis.LOG_NOTICE, string.format('[ATTEMPT_PURCHASE] User %s attempting purchase. Current stock: %d', userId, stock))
  
  -- Check if stock is available (must be > 0 to allow purchase)
  if stock <= 0 then
    -- No stock available, but still add user to attempted set
    redis.call('SADD', attemptedSetKey, userId)
    redis.log(redis.LOG_NOTICE, string.format('[ATTEMPT_PURCHASE] User %s attempted but stock is 0 or negative. Stock: %d', userId, stock))
    return {0, stock, 1}
  end
  
  -- Decrement stock atomically and check result
  -- DECR returns the new value after decrementing
  local newStock = redis.call('DECR', stockKey)
  
  -- Double-check: if stock went negative, we have a problem (shouldn't happen with proper checks, but safety net)
  if newStock < 0 then
    -- Stock went negative - this shouldn't happen, but restore it
    redis.call('INCR', stockKey)
    redis.call('SADD', attemptedSetKey, userId)
    redis.log(redis.LOG_WARNING, string.format('[ATTEMPT_PURCHASE] User %s attempted but stock went negative. Restored stock. Stock: %d', userId, newStock + 1))
    return {0, newStock + 1, 1}
  end
  
  -- Success: stock was decremented successfully
  redis.log(redis.LOG_NOTICE, string.format('[ATTEMPT_PURCHASE] User %s purchase successful. Stock decremented: %d -> %d', userId, stock, newStock))
  
  -- Add user to attempted set
  redis.call('SADD', attemptedSetKey, userId)
  
  return {1, newStock, 1}
`;

/**
 * Get User Status Script
 * Atomically checks:
 * 1. If user is in attempted set
 * 2. If user has a result
 * 
 * Returns: [hasAttempted: 1/0, hasResult: 1/0, result: 1/0/null]
 * - hasAttempted: 1 if user attempted, 0 if not
 * - hasResult: 1 if result exists, 0 if not
 * - result: 1 if success, 0 if failed, nil if no result
 */
export const GET_USER_STATUS_SCRIPT = `
  local attemptedSetKey = KEYS[1]
  local resultKey = KEYS[2]
  local userId = ARGV[1]
  
  -- Check if user attempted
  local hasAttempted = redis.call('SISMEMBER', attemptedSetKey, userId)
  
  -- Check if result exists
  local result = redis.call('GET', resultKey)
  local hasResult = result ~= nil and 1 or 0
  local resultValue = result and tonumber(result) or nil
  
  return {hasAttempted, hasResult, resultValue}
`;

/**
 * Set User Result Script
 * Sets the user result with TTL
 */
export const SET_USER_RESULT_SCRIPT = `
  local resultKey = KEYS[1]
  local success = ARGV[1]
  local ttl = ARGV[2]
  
  redis.call('SETEX', resultKey, ttl, success)
  return 1
`;

/**
 * Initialize Stock Script
 * Sets stock value if not exists, or updates if exists
 */
export const INITIALIZE_STOCK_SCRIPT = `
  local stockKey = KEYS[1]
  local stock = tonumber(ARGV[1])
  
  redis.call('SET', stockKey, stock)
  redis.log(redis.LOG_NOTICE, string.format('[INITIALIZE_STOCK] Stock initialized for key %s: %d', stockKey, stock))
  return stock
`;

/**
 * Restore Stock Script
 * Increments stock by 1 (used for rollback)
 */
export const RESTORE_STOCK_SCRIPT = `
  local stockKey = KEYS[1]
  local oldStock = tonumber(redis.call('GET', stockKey) or '0')
  local newStock = redis.call('INCR', stockKey)
  redis.log(redis.LOG_NOTICE, string.format('[RESTORE_STOCK] Stock restored for key %s: %d -> %d', stockKey, oldStock, newStock))
  return newStock
`;

