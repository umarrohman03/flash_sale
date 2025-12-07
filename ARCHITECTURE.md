# Flash Sale System Architecture

## System Architecture Diagram

### PlantUML Diagram (PlantText Compatible)

Copy the following PlantUML code to [PlantText](https://www.planttext.com/) to view and edit the diagram:

```plantuml
@startuml Flash Sale System Architecture
!theme plain
skinparam componentStyle rectangle
skinparam linetype ortho

package "External Layer" {
  [Users/API Clients] as Users
}

package "API Layer - Stateless (Auto-scales)" #LightBlue {
  [Express API Server\nPort: 3001\nTypeScript] as API
  [Auth Middleware\nJWT Validation] as AuthMW
  [API Routes\n/api/auth/*\n/api/flash-sale/*\n/api/orders/*] as Routes
  note right of Routes
    **Endpoints:**
    - GET /api/flash-sale/status
    - POST /api/flash-sale/attempt/:saleId
    - GET /api/orders/status/:productId
    - POST /api/auth/login
    - POST /api/auth/register
  end note
}

package "Service Layer - Business Logic" #Lavender {
  [FlashSaleService\ngetStatus\nattemptPurchase] as FlashSaleSvc
  [AuthService\nlogin\nregister] as AuthSvc
}

package "Infrastructure Layer - Hot Path" #LightYellow {
  database "Redis\nPort: 6379\nHot Path Data" as Redis {
    [Stock Keys\nflashsale:stock:{productId}] as RedisStock
    [User Sets\nflashsale:users:{productId}] as RedisUserSet
    [User Results\nflashsale:result:{userId}:{productId}] as RedisUserResult
    [Lua Scripts\nAtomic Operations\nConcurrency Control] as RedisLua
  }
}

package "Message Queue" #LightYellow {
  queue "Kafka Broker\nPort: 29092/9093\nTopic: flashsale.attempts" as Kafka
  [Zookeeper\nPort: 2181] as Zookeeper
}

package "Worker Layer" #Pink {
  [Kafka Consumer Worker\nConsumer Group] as Worker
  [Process Attempts\nValidate Stock\nCreate Orders\nUpdate Results] as WorkerLogic
}

package "Database Layer - Persistent Storage" #LightGreen {
  database "PostgreSQL\nPort: 5432/5433" as PostgreSQL {
    [Tables:\nusers\nproducts\nflash_sales\norders\npurchase_attempts] as Tables
  }
}

package "Repository Layer" #LightGreen {
  [FlashSaleRepository] as FlashSaleRepo
  [OrderRepository] as OrderRepo
  [UserRepository] as UserRepo
  [PurchaseAttemptRepository] as PurchaseAttemptRepo
}

' User interactions
Users --> API : HTTP Requests
API --> AuthMW
AuthMW --> Routes

' Route to Service
Routes --> FlashSaleSvc
Routes --> AuthSvc
Routes --> Redis : Direct Redis Access\n(Order Status)

' Service to Infrastructure
FlashSaleSvc --> Redis : Atomic Operations
FlashSaleSvc --> Kafka : Publish Attempt
FlashSaleSvc --> FlashSaleRepo
AuthSvc --> UserRepo

' Redis internal structure
Redis --> RedisStock
Redis --> RedisUserSet
Redis --> RedisUserResult
Redis --> RedisLua

' Kafka flow
Kafka --> Zookeeper
Kafka --> Worker : Consume Messages
Worker --> WorkerLogic

' Worker to Infrastructure
WorkerLogic --> Redis : Verify Stock
WorkerLogic --> OrderRepo : Create Orders
WorkerLogic --> FlashSaleRepo : Update Stock

' Repository to Database
FlashSaleRepo --> PostgreSQL
OrderRepo --> PostgreSQL
UserRepo --> PostgreSQL
PurchaseAttemptRepo --> PostgreSQL
PostgreSQL --> Tables

note right of Redis
  **Hot Path Data:**
  - Stock management
  - User attempt tracking
  - Result caching
  - Atomic Lua scripts
end note

note right of Kafka
  **Async Processing:**
  - Topic: flashsale.attempts
  - Keyed by userId
  - Consumer group processing
end note

note right of PostgreSQL
  **Persistent Storage:**
  - Orders (source of truth)
  - Users, Products
  - Flash Sales
  - Purchase Attempts (audit)
end note

@enduml
```

## Component Interaction Flow

### 1. Purchase Attempt Flow

Copy to [PlantText](https://www.planttext.com/):

```plantuml
@startuml Purchase Attempt Flow
!theme plain
skinparam sequenceMessageAlign center

actor User
participant "API Server" as API
participant "Auth Middleware" as AuthMW
participant "FlashSaleService" as FlashSaleSvc
database Redis
queue Kafka
participant "Worker" as Worker
database PostgreSQL

User -> API : POST /api/flash-sale/attempt/:saleId\n(with JWT token)
API -> AuthMW : Validate JWT token
AuthMW -> API : User authenticated
API -> FlashSaleSvc : attemptPurchase(userId, saleId)

FlashSaleSvc -> Redis : Atomic stock decrement\n(Lua script)
Redis --> FlashSaleSvc : Stock decremented

FlashSaleSvc -> Redis : Check user already attempted\n(SADD flashsale:users:{productId})
Redis --> FlashSaleSvc : User not in set

FlashSaleSvc -> Kafka : Publish attempt message\n(keyed by userId)
Kafka --> FlashSaleSvc : Message published

FlashSaleSvc -> PostgreSQL : Log purchase attempt\n(purchase_attempts table)
FlashSaleSvc --> API : Success response
API --> User : 200 OK

note over Kafka, Worker
  **Async Processing**
end note

Kafka -> Worker : Consume attempt message
Worker -> Redis : Verify stock availability
Worker -> PostgreSQL : Check existing order
Worker -> PostgreSQL : Create order (SUCCESS)
Worker -> Redis : Set user result (success)

@enduml
```

### 2. Flash Sale Status Check Flow

Copy to [PlantText](https://www.planttext.com/):

```plantuml
@startuml Flash Sale Status Check Flow
!theme plain
skinparam sequenceMessageAlign center

actor User
participant "API Server" as API
participant "Auth Middleware" as AuthMW
participant "FlashSaleService" as FlashSaleSvc
participant "FlashSaleRepository" as FlashSaleRepo
database PostgreSQL

User -> API : GET /api/flash-sale/status\n(with JWT token)
API -> AuthMW : Validate JWT token
AuthMW -> API : User authenticated
API -> FlashSaleSvc : getStatus()

FlashSaleSvc -> FlashSaleRepo : findActive() or findMostRecent()
FlashSaleRepo -> PostgreSQL : Query flash_sales + products
PostgreSQL --> FlashSaleRepo : Flash sale data\n(id, productId, productName, etc.)
FlashSaleRepo --> FlashSaleSvc : FlashSale object

FlashSaleSvc -> FlashSaleSvc : Calculate status\n(UPCOMING/ACTIVE/ENDED)
FlashSaleSvc --> API : StatusResponse\n(id, status, productId, productName, etc.)
API --> User : 200 OK with status

@enduml
```

### 3. Order Status Check Flow (Redis Direct Access)

Copy to [PlantText](https://www.planttext.com/):

```plantuml
@startuml Order Status Check Flow
!theme plain
skinparam sequenceMessageAlign center

actor User
participant "API Server" as API
participant "Auth Middleware" as AuthMW
database Redis

User -> API : GET /api/orders/status/:productId\n(with JWT token)
API -> AuthMW : Validate JWT token
AuthMW -> API : User authenticated

API -> Redis : getUserResult(userId, productId)\nKey: flashsale:result:{userId}:{productId}
Redis --> API : Result (true/false/null)

API -> API : Map result to status\n(true=SUCCESS, false=FAILED, null=PENDING)
API --> User : 200 OK\n{productId, userId, status}

note right of API
  **Direct Redis Access:**
  - No database query needed
  - Fast response time
  - Reads from hot path cache
end note

@enduml
```

### 4. Authentication Flow

Copy to [PlantText](https://www.planttext.com/):

```plantuml
@startuml Authentication Flow
!theme plain
skinparam sequenceMessageAlign center

actor User
participant "API Server" as API
participant "AuthService" as AuthSvc
participant "UserRepository" as UserRepo
database PostgreSQL

User -> API : POST /api/auth/login\n{username, password}
API -> AuthSvc : login(username, password)
AuthSvc -> UserRepo : findByUsername(username)
UserRepo -> PostgreSQL : SELECT * FROM users
PostgreSQL --> UserRepo : User data
UserRepo --> AuthSvc : User object

AuthSvc -> AuthSvc : Verify password (bcrypt)
AuthSvc -> AuthSvc : Generate JWT token
AuthSvc --> API : {token, userId}
API --> User : 200 OK with token

@enduml
```

### 5. Complete System Architecture (PlantUML Component Diagram)

Copy to [PlantText](https://www.planttext.com/) for a comprehensive view:

```plantuml
@startuml Flash Sale Complete Architecture
!theme plain
skinparam componentStyle rectangle
skinparam linetype ortho
skinparam shadowing false

left to right direction

package "External" {
  [Users/API Clients] as Users
}

package "API Layer" #LightBlue {
  [Express API Server\n:3001] as API
  [Auth Middleware] as AuthMW
  [Routes] as Routes
}

package "Service Layer" #Lavender {
  [FlashSaleService] as FlashSaleSvc
  [AuthService] as AuthSvc
}

package "Infrastructure" #LightYellow {
  database "Redis\n:6379" as Redis
  queue "Kafka\n:29092" as Kafka
  [Zookeeper\n:2181] as Zookeeper
}

package "Worker" #Pink {
  [Kafka Consumer] as Worker
}

package "Database" #LightGreen {
  database "PostgreSQL\n:5432" as PostgreSQL
  [FlashSaleRepository] as FlashSaleRepo
  [OrderRepository] as OrderRepo
  [UserRepository] as UserRepo
  [PurchaseAttemptRepository] as PurchaseAttemptRepo
}

Users --> API
API --> AuthMW
AuthMW --> Routes
Routes --> FlashSaleSvc
Routes --> AuthSvc
Routes --> Redis : Order Status\n(Direct Access)
FlashSaleSvc --> Redis
FlashSaleSvc --> Kafka
FlashSaleSvc --> FlashSaleRepo
AuthSvc --> UserRepo
Kafka --> Zookeeper
Kafka --> Worker
Worker --> Redis
Worker --> OrderRepo
Worker --> FlashSaleRepo
FlashSaleRepo --> PostgreSQL
OrderRepo --> PostgreSQL
UserRepo --> PostgreSQL
PurchaseAttemptRepo --> PostgreSQL

note right of Redis
  **Hot Path:**
  - Stock: flashsale:stock:{id}
  - Users: flashsale:users:{id}
  - Results: flashsale:result:{userId}:{id}
  - Lua Scripts (Atomic)
end note

note right of Kafka
  **Topic:** flashsale.attempts
  **Key:** userId
  **Partitions:** 1
end note

note right of PostgreSQL
  **Tables:**
  - users
  - products
  - flash_sales
  - orders
  - purchase_attempts
end note

@enduml
```

## Technology Stack

### Core Technologies
- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Message Queue**: Apache Kafka 7.5.0
- **Containerization**: Docker & Docker Compose

### Key Libraries
- **Authentication**: jsonwebtoken, bcrypt
- **Database**: pg (PostgreSQL client)
- **Redis**: ioredis
- **Kafka**: kafkajs
- **API Documentation**: swagger-jsdoc, swagger-ui-express
- **Logging**: winston

## Data Flow Patterns

### Hot Path (Redis)
- **Stock Management**: Real-time stock count (`flashsale:stock:{productId}`)
- **User Tracking**: Users who attempted purchase (`flashsale:users:{productId}`)
- **Results Cache**: Purchase results (`flashsale:result:{userId}:{productId}`)
  - Used by `/api/orders/status/:productId` endpoint for direct Redis access
  - Returns: `SUCCESS`, `FAILED`, or `PENDING` status
- **Atomic Operations**: Lua scripts ensure concurrency control

### Cold Path (PostgreSQL)
- **Persistent Storage**: Orders, users, products, flash sales
- **Audit Trail**: Purchase attempts log
- **Data Integrity**: Foreign keys, unique constraints
- **Flash Sale Status**: Queries flash_sales and products tables for status endpoint

### Async Processing (Kafka)
- **Message Topic**: `flashsale.attempts` (keyed by userId)
- **Consumer Group**: `flash-sale-worker-group`
- **Processing**: Worker consumes messages and creates orders
- **Result Storage**: Worker sets purchase results in Redis after processing

## Scalability Features

1. **Stateless API**: Can scale horizontally
2. **Redis Cluster**: Supports horizontal scaling
3. **Kafka Partitions**: Enables parallel processing
4. **Worker Consumer Groups**: Multiple workers can process messages
5. **Database Connection Pooling**: Efficient database connections

## Security Features

1. **JWT Authentication**: Token-based auth for API endpoints
2. **Password Hashing**: bcrypt for secure password storage
3. **CORS**: Configured for frontend access
4. **Input Validation**: Request validation on all endpoints

## Fault Tolerance

1. **Redis Retry Logic**: Automatic reconnection
2. **Kafka Non-blocking**: API doesn't fail if Kafka is unavailable
3. **Stock Rollback**: Stock restored if Kafka publish fails
4. **Database Transactions**: ACID compliance for data integrity
5. **Health Checks**: Docker health checks for all services

## Using PlantText

To view and edit these diagrams:

1. Go to [PlantText](https://www.planttext.com/)
2. Copy any of the PlantUML code blocks above (between `@startuml` and `@enduml`)
3. Paste into the PlantText editor
4. The diagram will render automatically
5. You can edit, export (PNG, SVG, PDF), or share the diagram

### Available Diagrams

1. **Flash Sale System Architecture** - Complete system overview
2. **Purchase Attempt Flow** - Sequence diagram for purchase flow
3. **Flash Sale Status Check Flow** - Sequence diagram for flash sale status check
4. **Order Status Check Flow** - Sequence diagram for order status check (direct Redis access)
5. **Authentication Flow** - Sequence diagram for login
6. **Complete System Architecture** - Comprehensive component diagram

## API Endpoints Summary

### Flash Sale Endpoints
- **GET /api/flash-sale/status** - Get current flash sale status (returns id, status, productId, productName, productDescription)
- **POST /api/flash-sale/attempt/:saleId** - Attempt to purchase an item (requires JWT token)

### Order Endpoints
- **GET /api/orders/status/:productId** - Get order status from Redis (requires JWT token, reads directly from Redis cache)

### Authentication Endpoints
- **POST /api/auth/login** - User login (returns JWT token)
- **POST /api/auth/register** - User registration

## Key Architecture Updates

### Order Status Endpoint Optimization
- **Changed from**: `/api/orders/status/:saleId` (queried database to get productId)
- **Changed to**: `/api/orders/status/:productId` (reads directly from Redis)
- **Benefits**:
  - No database query required
  - Faster response time
  - Reduced database load
  - Direct access to hot path data in Redis

### Flash Sale Status Enhancement
- **Added**: `productId` field to status response
- **Response includes**: id, status, startTime, endTime, currentTime, productId, productName, productDescription
