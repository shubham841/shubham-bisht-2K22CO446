# Boostly - Student Recognition Platform

A credit-based peer recognition system built with Node.js, Express.js, and PostgreSQL (Neon).

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL database (Neon recommended)
- npm or yarn package manager

### Installation Steps

1. **Install Dependencies**
   ```bash
   cd src
   npm install
   ```

2. **Configure Environment Variables**
   
   Create a `.env` file in the root directory (one level up from `src/`) with your Neon PostgreSQL connection string:
   ```
   DATABASE_URL=postgresql://username:password@host/database?sslmode=require
   ```

3. **Database Setup**
   
   Run the SQL schema from `init.sql` to create tables. You can execute it directly in your Neon SQL editor or use:
   ```bash
   psql $DATABASE_URL -f init.sql
   ```
   
   This creates three tables:
   - `users` - Student information and credit balances
   - `recognitions` - Recognition transactions
   - `endorsements` - Endorsements on recognitions

## Running the Application

Start the server:
```bash
cd src
node server.js
```

The server will start on **port 3000**.

Access the API at: `http://localhost:3000`

## API Endpoints

### 1. Create User
**POST** `/api/users`

Create a new student/user in the system.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Response (201):**
```json
{
  "user_id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "credits_received": 0,
  "credits_to_give": 100,
  "monthly_sent": 0
}
```

---

### 2. Get User Details
**GET** `/api/users/:id`

Retrieve details of a specific user.

**Response (200):**
```json
{
  "user_id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "credits_received": 25,
  "credits_to_give": 80,
  "monthly_sent": 20
}
```

**Error Response (404):**
```json
{
  "error": "User not found"
}
```

---

### 3. Send Recognition
**POST** `/api/recognitions`

Send credits from one student to another as recognition.

**Request Body:**
```json
{
  "sender_id": 1,
  "recipient_id": 2,
  "amount": 20,
  "message": "Great job on the project!"
}
```

**Response (201):**
```json
{
  "recognition_id": 1,
  "sender_id": 1,
  "recipient_id": 2,
  "amount": 20,
  "message": "Great job on the project!",
  "created_at": "2025-11-13T10:30:00.000Z"
}
```

**Error Responses:**

Self-recognition (400):
```json
{
  "error": "Self-recognition is not allowed"
}
```

Insufficient credits (500):
```json
{
  "error": "Insufficient credits"
}
```

Monthly limit exceeded (500):
```json
{
  "error": "Monthly sending limit exceeded"
}
```

---

### 4. Endorse Recognition
**POST** `/api/recognitions/:id/endorse`

Endorse an existing recognition (like/cheer).

**Request Body:**
```json
{
  "user_id": 3
}
```

**Response (201):**
```json
{
  "message": "Endorsement created successfully"
}
```

**Error Response (409) - Duplicate:**
```json
{
  "error": "You have already endorsed this recognition"
}
```

---

### 5. Redeem Credits
**POST** `/api/redeem`

Redeem received credits for vouchers (₹5 per credit).

**Request Body:**
```json
{
  "user_id": 2,
  "credits_to_redeem": 50
}
```

**Response (200):**
```json
{
  "message": "Credits redeemed successfully",
  "voucher_value_inr": 250
}
```

**Error Response (500):**
```json
{
  "error": "Insufficient credits to redeem"
}
```

---

### 6. View Leaderboard
**GET** `/api/leaderboard?limit=10`

Get top students ranked by credits received.

**Query Parameters:**
- `limit` (optional) - Number of top students to return (default: 10)

**Response (200):**
```json
[
  {
    "user_id": 2,
    "name": "Jane Smith",
    "credits_received": 150,
    "recognitions_received_count": "8",
    "total_endorsements_received": "15"
  },
  {
    "user_id": 1,
    "name": "John Doe",
    "credits_received": 120,
    "recognitions_received_count": "5",
    "total_endorsements_received": "10"
  }
]
```

## Sample Requests and Responses

### cURL Examples

**Create a user:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'
```

**Send recognition:**
```bash
curl -X POST http://localhost:3000/api/recognitions \
  -H "Content-Type: application/json" \
  -d '{"sender_id":1,"recipient_id":2,"amount":30,"message":"Excellent work!"}'
```

**Endorse recognition:**
```bash
curl -X POST http://localhost:3000/api/recognitions/1/endorse \
  -H "Content-Type: application/json" \
  -d '{"user_id":3}'
```

**Redeem credits:**
```bash
curl -X POST http://localhost:3000/api/redeem \
  -H "Content-Type: application/json" \
  -d '{"user_id":2,"credits_to_redeem":50}'
```

**Get leaderboard:**
```bash
curl http://localhost:3000/api/leaderboard?limit=5
```

**Get user details:**
```bash
curl http://localhost:3000/api/users/1
```

## Features

### Core Functionality
1. **Recognition System** - Transfer credits between students
2. **Endorsements** - Like/cheer recognition entries
3. **Redemption** - Convert credits to vouchers (₹5 per credit)

### Step-Up Challenges
1. **Automatic Credit Reset** - Monthly cron job (1st of every month at midnight)
   - Resets `credits_to_give` to 100
   - Carries forward up to 50 unused credits
   - Resets `monthly_sent` to 0

2. **Leaderboard** - Ranked list of top recipients
   - Sorted by credits received
   - Includes recognition and endorsement counts

## Business Rules

- Each student starts with 100 credits monthly
- Monthly sending limit: 100 credits
- Self-recognition is not allowed
- One endorsement per user per recognition
- Credits redeem at ₹5 per credit
- Up to 50 unused credits carry forward monthly

## Error Handling

All endpoints include proper error handling:
- **400** - Bad Request (validation errors)
- **404** - Not Found (user/resource not found)
- **409** - Conflict (duplicate endorsement)
- **500** - Internal Server Error (database errors, insufficient credits, etc.)
