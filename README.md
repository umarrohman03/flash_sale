# Flash Sale Backend Service

A high-performance, scalable flash sale backend service built with TypeScript, following SOLID principles.

> 📖 **For detailed system architecture diagrams, component interactions, and design decisions, see [ARCHITECTURE.md](./ARCHITECTURE.md)**

## Architecture

- **Stateless API (TypeScript)** - Autoscales horizontally
- **Redis Cluster** - Hot path for stock management, user tracking, and results cache
  - Direct Redis access for order status checks (no database query)
- **Kafka** - Topic `flashsale.attempts` (keyed by userId) for async processing
- **Worker Consumer Group** - Processes purchase attempts and creates orders
- **PostgreSQL** - Persistent order storage, flash sales, products, and users

📖 **See [ARCHITECTURE.md](./ARCHITECTURE.md) for:**
- Complete system architecture diagrams (PlantUML)
- Component interaction flows (sequence diagrams)
- Data flow patterns (hot path vs cold path)
- Technology stack details
- Scalability and security features

## Features

### Core Functional Requirements
- ✅ Flash sale period management (upcoming, active, ended)
- ✅ Single product with limited stock
- ✅ One item per user enforcement
- ✅ Status check endpoint
- ✅ Purchase attempt endpoint

### Non-Functional Requirements
- ✅ High throughput and scalability (stateless API, Redis for hot path)
- ✅ Robustness and fault tolerance (retry mechanisms, error handling)
- ✅ Concurrency control (Redis atomic operations, unique constraints)

## SOLID Principles Implementation

- **Single Responsibility**: Each class has one clear purpose
- **Open/Closed**: Services can be extended without modification
- **Liskov Substitution**: Interfaces ensure substitutability
- **Interface Segregation**: Focused interfaces (IRedisService, IKafkaProducer, etc.)
- **Dependency Inversion**: High-level modules depend on abstractions (interfaces)

## Project Structure

```
src/
├── api/                 # Express API routes and app setup
├── domain/             # Domain models and interfaces
│   ├── models/         # Domain entities
│   └── interfaces/     # Abstractions (SOLID)
├── infrastructure/     # External service implementations
│   ├── redis/          # Redis service
│   ├── kafka/          # Kafka producer/consumer
│   ├── database/       # PostgreSQL repository
│   └── logger/         # Logging utility
├── services/           # Business logic services
├── config/             # Configuration management
├── worker/             # Kafka consumer worker
└── index.ts            # API server entry point
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Copy environment file:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration

**Note**: The `.env` file is used for both Docker Compose and local development. Docker Compose services use service names directly (`redis`, `postgres`, `kafka:29092`) as configured in `docker-compose.yml`, so the `.env` values for service hosts don't affect Docker containers. For local development without Docker, use `localhost` values in `.env`.

### Running with Docker Compose

Start all services:
```bash
docker-compose up -d
```

This will start:
- PostgreSQL (port 5433 for external connections, 5432 internally)
- Redis (port 6379)
- Zookeeper (port 2181)
- Kafka (port 9093 for external access, 29092 internally)
- Kafka Topic Initializer (creates `flashsale.attempts` topic automatically)
- API Server (port 3001)
- Worker Service (enabled by default, see Feature Flags below)

The Kafka topic `flashsale.attempts` will be automatically created with 3 partitions when the services start.

### Running Locally

1. Start infrastructure services:
```bash
docker-compose up -d postgres redis zookeeper kafka
```

2. Build the project:
```bash
npm run build
```

3. Start the API server:
```bash
npm start
# or for development
npm run start:dev
```

4. Start the worker (in a separate terminal):
```bash
npm run start:worker
```

## API Endpoints

> 📖 **For detailed API endpoint documentation with request/response examples, see the [API Endpoints Summary](./ARCHITECTURE.md#api-endpoints-summary) section in ARCHITECTURE.md**

### Swagger Documentation

Interactive API documentation is available at:
- **Swagger UI**: `http://localhost:3001/api-docs`

The Swagger documentation provides:
- Complete API endpoint descriptions
- Request/response schemas
- Example requests and responses
- Try-it-out functionality
- Authentication examples

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "password123",
  "fullName": "New User"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "userId": "5",
    "username": "newuser",
    "email": "newuser@example.com",
    "fullName": "New User"
  }
}
```

**Response (409 Conflict - Username/Email exists):**
```json
{
  "success": false,
  "error": "Conflict",
  "message": "Username already exists"
}
```

**Response (400 Bad Request - Validation error):**
```json
{
  "success": false,
  "error": "Validation error",
  "message": "username, email, and password are required"
}
```

### POST /api/auth/login
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userId": "1"
  }
}
```

### GET /api/flash-sale/status
Get the current status of the flash sale, including product information.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "active",
    "startTime": "2024-01-01T00:00:00.000Z",
    "endTime": "2024-01-01T23:59:59.000Z",
    "currentTime": "2024-01-01T12:00:00.000Z",
    "productId": 1,
    "productName": "Premium Smartphone",
    "productDescription": "Latest model smartphone with advanced features"
  }
}
```

### POST /api/flash-sale/attempt/:saleId
Attempt to purchase an item from a specific flash sale. The user ID is automatically extracted from the JWT token in the Authorization header.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `saleId` (required): Flash sale ID (integer)

**Request Body:**
No request body required. User ID is extracted from the authentication token.

**Response (Success):**
```json
{
  "success": true,
  "message": "Your purchase attempt has been received and is being processed."
}
```

**Response (Failed):**
```json
{
  "success": false,
  "message": "Sorry, the item is out of stock."
}
```

**Response (Unauthorized):**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "User authentication required. Please provide a valid token."
}
```

### GET /api/orders/status/:productId
Get the authenticated user's purchase result status for a specific product from Redis. The user ID is automatically extracted from the JWT token. This endpoint reads directly from Redis cache without querying the database for optimal performance.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `productId` (required): Product ID (integer)

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "productId": 1,
    "userId": "2",
    "status": "SUCCESS"
  }
}
```

**Response (Failed):**
```json
{
  "success": true,
  "data": {
    "productId": 1,
    "userId": "2",
    "status": "FAILED"
  }
}
```

**Response (Key Not Found - 400 Bad Request):**
```json
{
  "success": false,
  "error": "Bad Request",
  "message": "Order status not found. The purchase attempt may not have been processed yet or the key does not exist in Redis."
}
```

**Status Values:**
- `SUCCESS`: Purchase was successful
- `FAILED`: Purchase attempt failed
- **400 Bad Request**: Order status key does not exist in Redis (purchase attempt not processed yet or key doesn't exist)

**Note:** This endpoint reads directly from Redis cache (`flashsale:result:{userId}:{productId}`) for fast response times. The status is set by the worker after processing the purchase attempt from Kafka. If the key doesn't exist, a 400 Bad Request is returned instead of a PENDING status.

## Concurrency Control

> 📖 **For detailed concurrency control flow diagrams, see the [Purchase Attempt Flow](./ARCHITECTURE.md#1-purchase-attempt-flow) section in ARCHITECTURE.md**

The system prevents overselling through:

1. **Redis Lua Scripts**: Atomic operations using Lua scripts ensure:
   - Stock check and decrement happen atomically
   - User attempt tracking is atomic with stock operations
   - No race conditions between concurrent requests
   
2. **Atomic Purchase Attempt**: The `attemptPurchase` Lua script atomically:
   - Checks if user already attempted
   - Checks and decrements stock if available
   - Adds user to attempted set
   - All in a single atomic operation

3. **User Set Tracking**: Redis SET ensures one attempt per user per product

4. **Database Unique Constraint**: PostgreSQL enforces one order per user-sale combination

5. **Idempotency**: Multiple checks prevent duplicate processing

6. **Result Caching**: Purchase results are cached in Redis (`flashsale:result:{userId}:{productId}`) for fast status checks without database queries

### Redis Lua Scripts

The system uses Redis Lua scripts for critical operations:

- **ATTEMPT_PURCHASE_SCRIPT**: Atomically handles purchase attempts (check user, check stock, decrement, add to set)
- **GET_USER_STATUS_SCRIPT**: Atomically checks user attempt status and result
- **SET_USER_RESULT_SCRIPT**: Sets user result with TTL
- **INITIALIZE_STOCK_SCRIPT**: Initializes stock value
- **RESTORE_STOCK_SCRIPT**: Restores stock (for rollback scenarios)

Scripts are loaded on Redis connection and cached using SHA1 hashes (EVALSHA) for better performance.

## Scalability

> 📖 **For detailed scalability features and architecture patterns, see the [Scalability Features](./ARCHITECTURE.md#scalability-features) section in ARCHITECTURE.md**

- **Stateless API**: Can be horizontally scaled
- **Redis Hot Path**: Fast stock checks, user tracking, and result caching
  - Order status endpoint reads directly from Redis (no database query)
- **Kafka Async Processing**: Decouples API from order creation
- **Worker Scaling**: Multiple worker instances can process messages in parallel
- **Direct Redis Access**: Order status checks bypass database for optimal performance

## Testing

Example API calls:

```bash
# Check status (requires authentication)
curl http://localhost:3001/api/flash-sale/status \
  -H "Authorization: Bearer <your-token-here>"

# Register a new user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "newuser", "email": "newuser@example.com", "password": "password123", "fullName": "New User"}'

# Login to get token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Attempt purchase (use token from login response, specify sale ID)
curl -X POST http://localhost:3001/api/flash-sale/attempt/1 \
  -H "Authorization: Bearer <your-token-here>"

# Get order status by product ID (requires authentication, reads from Redis)
curl http://localhost:3001/api/orders/status/1 \
  -H "Authorization: Bearer <your-token-here>"
```

## Feature Flags

### ENABLE_CONSUMER

Controls whether the Kafka consumer/worker service processes messages and creates orders.

- **Default:** `true` (consumer enabled)
- **Environment Variable:** `ENABLE_CONSUMER`
- **Values:** `true` or `false`

**Usage:**

1. **Docker Compose:**
   - Consumer is enabled by default (`ENABLE_CONSUMER=true`)
   - Docker Compose automatically reads `ENABLE_CONSUMER` from the `.env` file in the same directory
   - To disable, set `ENABLE_CONSUMER=false` in your `.env` file
   - Or override when running: `ENABLE_CONSUMER=false docker-compose up -d worker`
   - The worker service will check this flag on startup and exit gracefully if disabled

2. **Local Development:**
   - Consumer is enabled by default
   - To disable, add `ENABLE_CONSUMER=false` to your `.env` file
   - Run `npm run start:worker` - it will check the flag before starting

**Example:**
```bash
# Disable consumer in .env (if needed)
echo "ENABLE_CONSUMER=false" >> .env

# Or set it when running docker-compose
ENABLE_CONSUMER=false docker-compose up -d worker

# Or update docker-compose.yml to set ENABLE_CONSUMER: false in worker environment
```

**Note:** When the consumer is disabled, purchase attempts will still be sent to Kafka, but orders will not be created until the consumer is enabled. This is useful for:
- Development/testing scenarios where you want to test the API without processing orders
- Maintenance windows
- Gradual rollout of the consumer service

## Database Migrations

The project uses a custom migration system to manage database schema changes. The migration runner provides:

- ✅ Automatic migration tracking
- ✅ Transactional migrations (rollback on failure)
- ✅ Migration validation and ordering
- ✅ Support for both development (TypeScript) and production (JavaScript)
- ✅ Detailed logging and error reporting

### Running Migrations

**Development (connects to Docker PostgreSQL on localhost:5432):**
```bash
npm run migrate
```

The migration script is configured to connect to the Docker PostgreSQL instance by default. If you need to connect to a different database, set the following environment variables:
- `POSTGRES_HOST` (default: localhost)
- `POSTGRES_PORT` (default: 5432)
- `POSTGRES_USER` (default: postgres1)
- `POSTGRES_PASSWORD` (default: postgres1)
- `POSTGRES_DB` (default: flash_sale)

**Resetting Migrations for a New Database:**

If you switch to a new database (e.g., `POSTGRES_DB=flash_sale_4`) and want to re-run all migrations including seed data:

```bash
# Reset migrations table (clears migration tracking)
POSTGRES_DB=flash_sale_4 npm run migrate:reset

# Run all migrations again (including seed data)
POSTGRES_DB=flash_sale_4 npm run migrate
```

**Troubleshooting Seed Data Migration:**

If seed data is not appearing in a new database:

1. **Check if migration was applied:**
   ```sql
   SELECT * FROM migrations WHERE name = '007_seed_data';
   ```

2. **Check if data exists:**
   ```sql
   SELECT * FROM flash_sales;
   SELECT * FROM products WHERE sku = 'FLASH-001';
   ```

3. **Reset and re-run:**
   ```bash
   # Clear migration tracking
   POSTGRES_DB=flash_sale_4 npm run migrate:reset
   
   # Run migrations again
   POSTGRES_DB=flash_sale_4 npm run migrate
   ```

4. **Check migration logs:**
   - The seed data migration now includes detailed logging
   - Look for messages like:
     - `🌱 Starting seed data migration...`
     - `✅ Successfully created flash sale...`
     - `📦 Using FLASH_SALE_TOTAL_STOCK=3...`

**Note:** The seed data migration (`007_seed_data`) will:
- Insert users, products, and flash sales if they don't exist
- Use `FLASH_SALE_TOTAL_STOCK` from `.env` for flash sale stock
- Log detailed information about what it's doing
- Throw errors if critical steps fail (e.g., product not found)

**Production:**
```bash
npm run migrate:prod
```

**Note:** When running migrations locally, ensure Docker PostgreSQL is running:
```bash
docker-compose up -d postgres
```

### Migration Files

Migrations are located in `src/infrastructure/database/migrations/files/` and are automatically applied in order based on their filename prefix (e.g., `001_`, `002_`).

Each migration file must export a `migration` object with:
- `name`: Unique migration identifier (should match filename)
- `up`: SQL to apply the migration
- `down`: SQL to rollback the migration

### Current Migrations

1. **001_create_orders_table** - Initial simple orders table (legacy, replaced by 004)
2. **002_create_products_table** - Products table for flash sale items
3. **003_create_flash_sales_table** - Flash sales table with status enum and indexes
4. **004_create_orders_table** - Orders table with UUID extension, status enum, and constraints
5. **005_create_purchase_attempts_table** - Purchase attempts table for audit logging

### Migration Features

- **Automatic tracking**: Migrations are tracked in a `migrations` table
- **Idempotent**: Running migrations multiple times is safe
- **Transactional**: Each migration runs in a transaction (rolls back on error)
- **Validation**: Migration names and structure are validated
- **Ordering**: Migrations are applied in filename order

Migrations are automatically run when using Docker Compose via the `migrate` service.

## Environment Variables

All configuration is managed through environment variables. A `.env.example` file is provided as a template.

### Configuration File Setup

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Update `.env` with your specific configuration values.

### Available Configuration Variables

#### Server Configuration
- `PORT` - API server port (default: `3000`)
- `NODE_ENV` - Environment mode: `development` or `production` (default: `development`)

#### Redis Configuration
- `REDIS_HOST` - Redis host (default: `localhost`)
- `REDIS_PORT` - Redis port (default: `6379`)
- `REDIS_PASSWORD` - Redis password (optional)
- `REDIS_CLUSTER_MODE` - Enable Redis cluster mode: `true` or `false` (default: `false`)

#### Kafka Configuration
- `KAFKA_BROKERS` - Comma-separated list of Kafka brokers (default: `localhost:9092`)
- `KAFKA_CLIENT_ID` - Kafka client identifier (default: `flash-sale-api`)
- `KAFKA_TOPIC_FLASH_SALE_ATTEMPTS` - Kafka topic for purchase attempts (default: `flashsale.attempts`)
- `KAFKA_CONSUMER_GROUP` - Kafka consumer group name (default: `flash-sale-worker-group`)

#### PostgreSQL Configuration
- `POSTGRES_HOST` - PostgreSQL host (default: `localhost`)
- `POSTGRES_PORT` - PostgreSQL port (default: `5433` for local connections, `5432` for Docker internal)
- `POSTGRES_USER` - PostgreSQL username (default: `postgres1`)
- `POSTGRES_PASSWORD` - PostgreSQL password (default: `postgres1`)
- `POSTGRES_DB` - PostgreSQL database name (default: `flash_sale`)

#### Flash Sale Configuration
- `FLASH_SALE_START_TIME` - Flash sale start time in ISO 8601 format (default: `2024-01-01T00:00:00Z`)
- `FLASH_SALE_END_TIME` - Flash sale end time in ISO 8601 format (default: `2024-01-01T23:59:59Z`)
- `FLASH_SALE_PRODUCT_ID` - Product ID for the flash sale (default: `flash-sale-product-001`)
- `FLASH_SALE_TOTAL_STOCK` - Total stock available for flash sale (default: `1000`)

#### Authentication Configuration
- `JWT_SECRET` - Secret key for JWT token signing (default: `your-secret-key-change-in-production`)
  - **⚠️ IMPORTANT**: Change this to a strong, random secret in production!
- `JWT_EXPIRES_IN` - JWT token expiration time (default: `24h`)
  - Examples: `1h`, `24h`, `7d`, `30d`

#### Worker Configuration
- `ENABLE_CONSUMER` - Enable Kafka consumer/worker to process messages and create orders (default: `true`)
  - Set to `false` to disable the consumer
  - When `false`, the worker will start but exit immediately without processing messages
  - Useful for development/testing or when you want to disable order processing temporarily

### Docker vs Local Configuration

When running with Docker Compose, the services use internal service names:
- Redis: `redis` (not `localhost`)
- Kafka: `kafka:9092` (not `localhost:9092`)
- PostgreSQL: `postgres` (not `localhost`)

The `.env` file is primarily for local development. Docker Compose services have their environment variables configured in `docker-compose.yml`.

See `.env.example` for the complete template with all available options.

## Stress Testing

The system includes a comprehensive stress test to validate performance and concurrency control under high load.

See [STRESS_TEST.md](./STRESS_TEST.md) for detailed documentation.

**Quick Start:**
```bash
# Run stress test with default settings (100 users, 50 concurrent)
npm run stress-test

# Custom configuration
STRESS_TEST_USERS=500 STRESS_TEST_CONCURRENT=200 npm run stress-test
```

The stress test validates:
- System performance under high concurrent load
- Concurrency control (no overselling)
- Response times and throughput
- Error handling and system stability

## License

ISC

