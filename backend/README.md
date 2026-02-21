# Event Booking System - Backend

A high-performance event booking system built with Node.js, Express, PostgreSQL, MongoDB, and Redis. This system handles concurrent seat bookings with robust locking mechanisms, comprehensive audit logging, and efficient queue-based processing.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running the Application](#running-the-application)
- [Architecture & Design](#architecture--design)
  - [Concurrency Handling](#concurrency-handling)
  - [Cancel/Return Operations](#cancelreturn-operations)
  - [Audit Logging](#audit-logging)
- [API Endpoints](#api-endpoints)
- [Postman Collection](#postman-collection)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)

## Prerequisites

Before setting up the backend, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **PostgreSQL** (v14 or higher)
- **MongoDB** (v6 or higher)
- **Redis** (v6 or higher)
- **npm** or **yarn**

## Setup

### 1. Clone the Repository

```bash
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file and update it with your configuration:

```bash
cp env.example .env
```

Edit `.env` and configure the following:

- **DATABASE_URL**: PostgreSQL connection string
- **MONGODB_URI**: MongoDB connection string (for audit logs)
- **REDIS_HOST** and **REDIS_PORT**: Redis connection details
- **JWT_SECRET**: Secret key for JWT token signing
- **PORT**: Server port (default: 3000)

### 4. Set Up PostgreSQL Database

Create a PostgreSQL database:

```bash
createdb event_booking
# Or using psql:
# psql -U postgres
# CREATE DATABASE event_booking;
```

### 5. Run Database Migrations

Generate Prisma client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 6. Start Required Services

Ensure the following services are running:

- **PostgreSQL**: `pg_ctl start` or via your system service manager
- **MongoDB**: `mongod` or via your system service manager
- **Redis**: `redis-server` or via your system service manager

## Running the Application

### Development Mode

Start the main API server:

```bash
npm run dev
```

In separate terminal windows, start the background workers:

```bash
# Audit log worker (processes audit logs asynchronously)
npm run worker:audit:watch

# Seat generation worker (generates seats for shows)
npm run worker:seat:watch
```

## Architecture & Design

### Concurrency Handling

The system implements a **two-layer locking mechanism** to prevent race conditions and ensure data consistency when multiple users attempt to book the same seats simultaneously:

#### 1. Redis Distributed Lock (First Layer)

- **Purpose**: Fast, distributed lock to prevent concurrent requests from reaching the database
- **Implementation**: Uses Redis Lua scripts for atomic operations
- **Key Format**: `seat_lock:{userId}:{bookingId}:{seatId}`
- **Process**:
  1. Before attempting a database transaction, the system attempts to acquire Redis locks for all requested seats
  2. Uses a Lua script that atomically checks availability and locks all seats in a single operation
  3. If any seat is already locked, the entire operation fails immediately
  4. Locks expire after 1 minute (configurable via `LOCK_DURATION_MS`)

#### 2. PostgreSQL Row-Level Locking (Second Layer)

- **Purpose**: Database-level consistency using PostgreSQL's `FOR UPDATE` clause
- **Implementation**: Uses Prisma transactions with raw SQL queries
- **Process**:
  1. Within a database transaction, uses `SELECT ... FOR UPDATE` to acquire row-level locks on all requested seats
  2. Checks seat availability (not booked and not locked by another user)
  3. Updates seat status and creates booking records atomically
  4. If any seat is unavailable, the transaction rolls back

#### Benefits of This Approach

- **Performance**: Redis provides fast rejection of conflicting requests before hitting the database
- **Consistency**: PostgreSQL transactions ensure ACID compliance and prevent double-booking
- **Scalability**: Works across multiple server instances (distributed locking via Redis)
- **Reliability**: Even if Redis fails, PostgreSQL locks provide a safety net

#### Example Flow

```
User A requests seats [1, 2, 3]
  ↓
Redis Lock: Acquire locks for seats 1, 2, 3
  ↓ (if successful)
PostgreSQL Transaction:
  - SELECT seats FOR UPDATE
  - Check availability
  - Update seats with lock info
  - Create PENDING booking
  ↓
Return booking ID to user
```

If User B tries to book seat 2 simultaneously:
- Redis lock fails immediately (fast rejection)
- User B receives error without database query

### Cancel/Return Operations

The system handles cancellations differently based on booking status:

#### PENDING Bookings (Not Confirmed)

- **Action**: Complete deletion of the booking record
- **Reason**: PENDING bookings are temporary holds that haven't been confirmed
- **Process**:
  1. Verify user ownership and booking status
  2. Within a transaction:
     - Release all seats (set status to AVAILABLE, clear locks)
     - Delete the booking record entirely
  3. Unlock Redis locks for the booking
  4. Log the operation as a deletion (not a cancellation)

#### CONFIRMED Bookings (Actual Cancellations)

- **Action**: Mark booking as CANCELLED (preserve record for audit trail)
- **Reason**: Confirmed bookings are real transactions that should be tracked
- **Process**:
  1. Verify user ownership and booking status
  2. Within a transaction:
     - Release all seats (set status to AVAILABLE, clear locks)
     - Update booking status to CANCELLED (preserve record)
  3. Unlock Redis locks for the booking
  4. Log the operation as a cancellation

#### Key Features

- **Atomic Operations**: All seat releases and booking updates happen in a single transaction
- **Multi-Seat Support**: Handles bookings with multiple seats correctly
- **Audit Trail**: CANCELLED bookings remain in the database for reporting and analytics
- **Clean State**: PENDING bookings are completely removed to keep the database clean

### Audit Logging

The system implements comprehensive, asynchronous audit logging for all critical operations:

#### Architecture

- **Storage**: MongoDB (optimized for write-heavy, document-based audit logs)
- **Processing**: BullMQ queue with dedicated worker processes
- **Idempotency**: Prevents duplicate log entries using SHA-256 hash-based keys

#### Logged Operations

The system logs the following operation types:

- **LOCK**: Seat locking attempts (success/failure)
- **BOOK**: Booking confirmations (success/failure)
- **CANCEL**: Booking cancellations (success/failure)
- **SHOW_CREATE**: Show creation events
- **SEAT_GENERATE**: Seat generation jobs

#### Process Flow

```
Operation occurs (e.g., lock seats)
  ↓
AuditService.logSuccess() or logFailure()
  ↓
Generate idempotency key (SHA-256 hash)
  ↓
Enqueue job to BullMQ audit-log queue
  ↓ (non-blocking, returns immediately)
API responds to user
  ↓
AuditLogWorker processes job asynchronously
  ↓
Check for duplicate (using idempotency key + time window)
  ↓
Write to MongoDB if not duplicate
```

#### Key Features

- **Non-Blocking**: Audit logging doesn't slow down API responses
- **Idempotent**: Duplicate prevention using hash-based keys and time windows
- **Retry Logic**: Failed log writes are retried automatically (exponential backoff)
- **Scalable**: Worker processes can be scaled horizontally
- **Queryable**: MongoDB allows flexible querying for analytics and debugging

#### Idempotency Key Generation

The system generates idempotency keys using:

```javascript
SHA256(operationType | bookingId | seatId | userId | showId | outcome | timestamp)
```

This ensures that:
- Duplicate requests (network retries) don't create duplicate logs
- Same operation with same parameters within a time window is deduplicated
- Logs remain unique and queryable

#### Worker Configuration

- **Concurrency**: 10 concurrent jobs per worker instance
- **Retry Policy**: 3 attempts with exponential backoff (1s, 2s, 4s)
- **Job Retention**: Completed jobs kept for 1 hour or max 1000 jobs

### Rate Limiting

The system implements **distributed rate limiting** using a token bucket algorithm to protect API endpoints from abuse and ensure fair resource usage across all users.

#### Architecture

- **Storage**: Redis (distributed, fast, and consistent across multiple server instances)
- **Algorithm**: Token bucket with configurable refill rate
- **Implementation**: Redis Lua scripts for atomic operations

#### How It Works

The token bucket algorithm works as follows:

1. Each endpoint has a bucket with a maximum number of tokens (requests allowed)
2. Tokens are consumed when requests are made
3. Tokens refill at a specified rate over a time window
4. If no tokens are available, the request is rejected with a 429 status

#### Rate Limit Configuration

The following endpoints have rate limiting applied:

| Endpoint | Rate Limit | Window | Purpose |
|----------|------------|--------|---------|
| `POST /api/users/login` | 5 requests | 1 minute | Prevent brute force attacks on login |
| `POST /api/admin/auth/login` | 5 requests | 1 minute | Prevent brute force attacks on admin login |
| `POST /api/seats/lock` | 5 requests | 5 minutes | Prevent abuse of seat locking mechanism |

#### Response Headers

All rate-limited endpoints include the following headers in responses:

- `X-RateLimit-Limit`: Maximum number of requests allowed in the window
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: ISO timestamp when the rate limit window resets

#### Rate Limit Exceeded Response

When a rate limit is exceeded, the API returns:

```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfterSeconds": 45
}
```

**HTTP Status**: `429 Too Many Requests`

#### Key Features

- **Distributed**: Works across multiple server instances using Redis
- **Atomic Operations**: Uses Redis Lua scripts to ensure thread-safe token management
- **IP-Based Tracking**: Rate limits are tracked per IP address and endpoint
- **Graceful Degradation**: If Redis is unavailable, rate limiting is bypassed (logs error but allows request)
- **Customizable**: Supports custom key generation, token limits, and refill rates

#### Implementation Details

The rate limiter uses a Redis Lua script that:

1. Atomically checks token availability
2. Refills tokens based on elapsed time
3. Consumes tokens if available
4. Returns remaining tokens and reset time
5. Sets appropriate expiration on Redis keys

This ensures that rate limiting is:
- **Fast**: Single Redis operation per request
- **Accurate**: No race conditions between multiple requests
- **Efficient**: Minimal network overhead

#### Customization

For custom rate limiting needs, you can use the `createRateLimiter` function:

```javascript
import { createRateLimiter } from './middleware/rateLimiter.js';

const customLimiter = createRateLimiter({
  maxTokens: 100,        // Maximum tokens in bucket
  refillRate: 10,        // Tokens to add per window
  windowMs: 1000,        // Time window in milliseconds
  keyPrefix: 'custom:',  // Redis key prefix
  keyGenerator: (req) => {
    // Custom key generation logic
    return `${req.user?.id || req.ip}:${req.path}`;
  }
});
```

## API Endpoints

### User Endpoints

- `POST /api/users/register` - Register a new user
- `POST /api/users/login` - User login
- `GET /api/users/bookings` - Get user's bookings (paginated)
- `POST /api/bookings/lock` - Lock seats for booking
- `POST /api/bookings/confirm` - Confirm a booking
- `POST /api/bookings/:id/cancel` - Cancel a booking

### Admin Endpoints

- `POST /api/admin/login` - Admin login
- `POST /api/admin/venues` - Create venue
- `POST /api/admin/events` - Create event
- `POST /api/admin/shows` - Create show
- `GET /api/admin/bookings` - Get all bookings (paginated)
- `GET /api/admin/audit-logs` - Get audit logs (filtered)

### Public Endpoints

- `GET /api/events` - List events
- `GET /api/shows/:id` - Get show details
- `GET /api/shows/:id/seats` - Get available seats for a show

## Postman Collection

A complete Postman collection is provided for testing all API endpoints. The collection includes pre-configured requests for all endpoints with proper authentication and environment variables.

### Files

- **`Event Booking System API.postman_collection.json`** - Complete API collection with all endpoints
- **`Event Booking System -env.postman_environment.json`** - Postman environment with variables

### Setup

1. **Import the Collection**
   - Open Postman
   - Click "Import" button
   - Select `Event Booking System API.postman_collection.json`
   - The collection will be imported with all endpoints organized by category

2. **Import the Environment**
   - Click "Import" in Postman
   - Select `Event Booking System -env.postman_environment.json`
   - Select the imported environment from the environment dropdown (top right)

3. **Configure Environment Variables**

   The environment includes the following variables:

   | Variable | Description | Default Value |
   |----------|-------------|---------------|
   | `base_url` | API base URL | `http://localhost:3000` |
   | `admin_token` | JWT token for admin (auto-set on login) | - |
   | `admin_id` | Admin user ID (auto-set on login) | - |
   | `user_token` | JWT token for regular user (auto-set on login) | - |
   | `user_id` | User ID (auto-set on login) | - |
   | `venue_id` | Venue ID (set after creating venue) | - |
   | `event_id` | Event ID (set after creating event) | - |
   | `show_id` | Show ID (set after creating show) | - |
   | `seat_id` | Seat ID (for testing) | - |
   | `seat_id_2` | Second seat ID (for testing) | - |
   | `pending_booking_id` | Booking ID (set after locking seats) | - |

### Features

- **Auto-authentication**: Login requests automatically set `admin_token` and `user_token` environment variables
- **Organized Structure**: Endpoints grouped by Admin, User, and Public categories
- **Pre-configured Requests**: All requests include proper headers and example request bodies
- **Environment Variables**: Dynamic values using `{{variable_name}}` syntax for easy testing

### Collection Structure

#### Admin Endpoints
- **Authentication**: Register, Login, Get Admin by ID, Get All Admins
- **User Management**: Get All Users, Get User by ID
- **Venues**: Create, Get All, Get by ID
- **Events**: Create, Get All, Get by ID
- **Shows**: Create, Get by ID, Get Status
- **Audit Logs**: Get logs with various filters (by show, user, operation type, outcome)

#### User Endpoints
- **Authentication**: Register, Login, Get My Profile
- **Shows**: Get Available Shows, Get Show by ID, Get Show Seats
- **Bookings**: Lock Seats, Confirm Booking, Cancel Booking, Get User Bookings, Get Booking by ID

#### Public Endpoints
- **Health Check**: Server health status

### Usage Tips

1. **Start with Authentication**: Use Admin or User login endpoints first to get authentication tokens
2. **Token Management**: Tokens are automatically saved to environment variables after successful login
3. **Sequential Testing**: Create resources in order (Venue → Event → Show → Booking)
4. **Update Variables**: Manually update IDs in environment after creating resources for dependent requests
5. **Base URL**: Update `base_url` in environment if your API runs on a different port or host

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | `3000` |
| `NODE_ENV` | Environment | No | `development` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `MONGODB_URI` | MongoDB connection string | Yes | - |
| `REDIS_HOST` | Redis host | No | `localhost` |
| `REDIS_PORT` | Redis port | No | `6379` |
| `REDIS_PASSWORD` | Redis password | No | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `JWT_EXPIRES_IN` | JWT expiration time | No | `7d` |

## Database Schema

### PostgreSQL (Core Data)

- **Users**: User accounts and authentication
- **Admins**: Admin accounts
- **Venues**: Event venues with seat counts
- **Events**: Events associated with venues
- **Shows**: Individual show instances
- **Seats**: Seat inventory with status and locks
- **Bookings**: Booking records (PENDING, CONFIRMED, CANCELLED)

### MongoDB (Audit Logs)

- **AuditLog**: Document-based audit trail with:
  - Operation type
  - User/booking/show IDs
  - Outcome (SUCCESS/FAILURE)
  - Timestamp
  - Metadata (JSON)
  - Reason (for failures)

## Technology Stack

- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: PostgreSQL (Prisma ORM)
- **Audit Storage**: MongoDB (Mongoose)
- **Cache/Queue**: Redis (ioredis, BullMQ)
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt

## Development

### Code Structure

```
backend/
├── src/
│   ├── config/          # Database, Redis configurations
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Auth, rate limiting, error handling
│   ├── models/          # MongoDB models (AuditLog)
│   ├── repositories/    # Data access layer
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic
│   ├── utils/           # Helper functions
│   ├── workers/         # Background job workers
│   ├── app.js           # Express app setup
│   └── index.js         # Server entry point
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── migrations/      # Database migrations
└── package.json
```

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## License

ISC

