# AI Voice Agent Management System (SHIAVNSKI)

Enterprise full-stack AI Voice Agent Management System built for the Shiavnski Technologies developer assignment. Features complete multi-tenant Agent Management, Outbound Call Management, Dynamic Operations Dashboard, Retell AI integration, and secure offline Mock Simulation.

---

## 1. System Architecture & Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router v6, Axios, Lucide React, Vitest + React Testing Library.
- **Backend**: Node.js, Express, TypeScript, Zod environment & schema validation, Vitest + Supertest.
- **Database**: PostgreSQL with Prisma ORM.
- **AI Telephony Abstraction**: Unified provider interface supporting:
  - **MOCK Simulation Mode** (`PROVIDER_MODE="mock"`): Zero-cost deterministic local simulation. Dispatches mock calls (`call_mock_*`), tracks transitions in PostgreSQL, and supports interactive pickup/hangup simulation without external network dependencies.
  - **RETELL Cloud Mode** (`PROVIDER_MODE="retell"`): Integrates with official Retell Node SDK (`v6.2.11`), handles cryptographically verified webhooks (HMAC-SHA256), and syncs live telephony telemetry.

```
                      +-----------------------------+
                      |     React + Vite Frontend   |
                      |   (Port 5173 / TailwindCSS) |
                      +--------------+--------------+
                                     |
                             REST API Calls
                                     v
                      +-----------------------------+
                      |     Express.js API Server   |
                      |    (Port 5000 / TypeScript) |
                      +--------------+--------------+
                                     |
                   +------------------+------------------+
                   |                                     |
                   v                                     v
        +--------------------+               +-----------------------+
        |   PostgreSQL DB    |               | Retell AI / Mock Mode |
        | (Prisma Port 5433) |               |  (REST & Webhooks)    |
        +--------------------+               +-----------------------+
```

---

## 2. Prerequisites

- **Node.js**: `v20.x` or higher (`v22.x` tested)
- **npm**: `v10.x` or higher
- **PostgreSQL**: `v14` or higher installed and running locally
  *(Note: On local development workstations, PostgreSQL default port is typically `5432` or `5433`).*

---

## 3. Environment Configuration

### Backend (`backend/.env`)

Copy the template from `backend/.env.example`:
```powershell
cp backend/.env.example backend/.env
```

Configuration fields:
```env
# Server
PORT=5000
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"

# Database Connection (Targeting local PostgreSQL)
# Replace YOUR_DB_PASSWORD with your local postgres password and adjust port if needed
DATABASE_URL="postgresql://postgres:YOUR_DB_PASSWORD@localhost:5433/voice_agent_db?schema=public"

# Authentication & Session Security (Minimum 32 characters)
JWT_SECRET="development-insecure-secret-key-change-in-production-min-32-chars"
JWT_EXPIRES_IN="24h"

# Provider Mode: "mock" (default, offline simulation) or "retell"
PROVIDER_MODE="mock"

# Retell AI Credentials (REQUIRED ONLY when PROVIDER_MODE="retell")
RETELL_API_KEY="your_retell_api_key_here"
RETELL_WEBHOOK_KEY=""
RETELL_FROM_NUMBER="+14155551234"
```

> **Security Guarantee**: Never commit `backend/.env` or expose API keys. The Retell API key is maintained strictly server-side and is never passed to frontend bundles or client responses.

### Frontend (`frontend/.env`)

Copy the template from `frontend/.env.example`:
```powershell
cp frontend/.env.example frontend/.env
```

```env
# Backend REST API Base URL
VITE_API_URL=http://localhost:5000/api

# Active Provider Mode Display Indicator ("mock" or "retell")
VITE_PROVIDER_MODE=mock
```

---

## 4. Database Setup & Migrations

### Step A: Verify or Create Local Database
Ensure the `voice_agent_db` database exists in your PostgreSQL instance:
```powershell
# Using psql on port 5433 (or adjust port to match your PostgreSQL instance):
psql -U postgres -p 5433 -c "CREATE DATABASE voice_agent_db;"
```

### Step B: Run Prisma Migrations
To apply existing migrations to your database without resetting or prompting:
```powershell
cd backend
npx prisma migrate deploy
npx prisma generate
```
*(Alternatively, for local schema development: `npx prisma migrate dev`)*

### Step C: Seed Demo Data (Recommended for Immediate Evaluation)
To populate a demo user, sample voice agents, and simulated call history:
```powershell
# From project root:
npm run seed
```
- **Demo Login**: `demo@shiavnski.com`
- **Demo Password**: `Password123!`
*(For a complete step-by-step UI evaluation guide, see [docs/DEMO_WALKTHROUGH.md](docs/DEMO_WALKTHROUGH.md))*

---

## 5. Development & Running Locally

### Option 1: Root Convenience Scripts
From the project root (`SHIAVNSKI/`):
```powershell
# Start Backend (Port 5000 with hot-reload via tsx)
npm run dev:backend

# In a separate terminal, start Frontend (Port 5173 via Vite)
npm run dev:frontend
```

### Option 2: Run Separately
```powershell
# Terminal 1 (Backend):
cd backend
npm run dev

# Terminal 2 (Frontend):
cd frontend
npm run dev
```

- Web UI: `http://localhost:5173`
- API Health Check: `http://localhost:5000/api/health`

---

## 6. Complete API Reference

All protected endpoints require an authenticated session cookie (`auth_token`) set during `/api/auth/login` or `/api/auth/register`.

### Authentication Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user account with bcryptjs hashed password |
| `POST` | `/api/auth/login` | Authenticate user credentials and set HttpOnly cookie |
| `GET` | `/api/auth/me` | Fetch authenticated user profile |
| `POST` | `/api/auth/logout` | Clear session cookie |

### Voice Agent Management Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/agents` | Create custom voice agent (name, voice, prompt, latency settings) |
| `GET` | `/api/agents` | List user's voice agents with search & pagination |
| `GET` | `/api/agents/:id` | Get specific agent configuration (user-isolated) |
| `PATCH` | `/api/agents/:id` | Update agent configuration |
| `DELETE` | `/api/agents/:id` | Delete agent (soft deletion / cascade protected) |

### Call Management & Telemetry Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/calls` | Dispatch outbound call with idempotency protection |
| `GET` | `/api/calls` | Paginated call history with masked phone numbers (`maskPhoneNumber`) |
| `GET` | `/api/calls/stats` | Dynamic dashboard KPIs (total, completed, failed, duration, success rate) |
| `GET` | `/api/calls/:id` | Detailed call record with masked destination/caller ID and dynamic variables |
| `POST` | `/api/calls/:id/simulate-step` | Deterministically progress mock call (`INITIATED` $\rightarrow$ `ONGOING` $\rightarrow$ `ENDED`) |

### Retell AI Webhooks & Provider Verification
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/webhooks/retell` | Cryptographically verified webhook ingestion (`x-retell-signature`) |
| `POST` | `/api/provider/verify` | Harmless read-only Retell API connectivity check (lists voices) |

> **Postman Collection Available**: An importable Postman Collection containing all above endpoints with pre-configured parameters and sample JSON bodies is available at `docs/Shiavnski_Voice_Agent_API.postman_collection.json`.

---

## 7. Provider Modes & Live Telephony Setup

### MOCK Simulation Mode (`PROVIDER_MODE="mock"`) [DEFAULT]
- **Zero Cost**: No external credits consumed, no phone numbers purchased.
- **Deterministic**: Dispatches calls with `call_mock_*` provider IDs.
- **Interactive Lifecycle**: Using the **"Simulate Pickup [MOCK]"** and **"Simulate Hangup [MOCK]"** controls in the Call Details modal, mock calls progress safely from `INITIATED` to `ONGOING` to `ENDED` with safe duration calculation and persisted `disconnectionReason = 'simulated_user_hangup'`.
- **Honest Telemetry**: Does not invent fake audio recordings or fabricated transcripts.

### Requirements for Live Telephony (`PROVIDER_MODE="retell"`)
To transition from Mock Mode to Live Retell Telephony, the following external prerequisites must be completed:
1. **Configured Retell Voice Agent**: Create and configure an agent in the Retell AI Dashboard.
2. **Provisioned Phone Number**: Purchase or link an E.164 phone number in Retell AI and configure `RETELL_FROM_NUMBER` in `backend/.env`.
3. **Public HTTPS Webhook URL**: Retell AI requires a public HTTPS URL (e.g. using ngrok for local development: `ngrok http 5000`) configured in your Retell dashboard pointing to `https://<your-subdomain>.ngrok.io/api/webhooks/retell`.
4. **End-to-End Verification**: Place an outbound call to a real phone number and verify that Retell webhook deliveries transition call states and stream recordings.

---

## 8. Automated Test Suite & Build Verification

The application includes automated unit, integration, and component tests across both backend and frontend.

### Running Backend Tests
```powershell
cd backend
npm test
```
*Result: 9 test files passed, 55/55 passed (including health, auth, agent CRUD, outbound call dispatch, phone masking, mock simulation, dashboard stats, and webhook signature/idempotency tests).*

### Running Frontend Tests
```powershell
cd frontend
npm test
```
*Result: 8 test files passed, 29/29 passed (including layout shell, persistent provider mode badge, agent CRUD, outbound call form validation, masked call list, call details modal, and dynamic dashboard metrics).*

### Running Entire Test Suite From Root
From the project root (`SHIAVNSKI/`):
```powershell
npm test
```
*Result: Automatically runs both `npm --prefix backend run test` and `npm --prefix frontend run test`, executing all 84 unit and integration tests (55 backend + 29 frontend).*

### Typecheck & Production Builds
```powershell
# From project root:
npm run build

# Or individually:
cd backend && npm run typecheck && npm run build
cd frontend && npm run build
```
Both builds produce clean production bundles (`dist/`) with zero TypeScript errors.

---

## 9. Known Limitations & Honest Implementation Status

1. **Default Mode is MOCK (`PROVIDER_MODE="mock"`)**:
   - The default configuration uses the offline mock provider so reviewers can run the complete application, execute test suites, create agents, dispatch calls, simulate transitions, and explore the dynamic dashboard without needing paid third-party accounts, external internet access, or telephone credit.
2. **Retell Live Telephony Status**:
   - The official Retell TypeScript SDK (`retell-sdk@6.2.11`) is fully integrated into the backend provider abstraction (`RetellVoiceProvider`).
   - Webhook cryptographic signature verification is implemented using Retell's official `Retell.verify()` HMAC-SHA256 static method, with duplicate event idempotency, retry counting, terminal state protection, and orphan handling.
   - **Honest Boundary**: Real live PSTN outbound calls, live phone recordings, and public webhook tunneling (e.g. via ngrok/public domain) were not placed or billed against a paid Retell account during this development phase.
3. **No Fabricated Telemetry**:
   - In Mock Mode, call progression (`INITIATED` $\rightarrow$ `ONGOING` $\rightarrow$ `ENDED`), disconnection reasons, and durations are deterministically simulated for UI testing.
   - Call audio recordings, verbatim transcripts, and sentiment analysis are presented conditionally in the UI only when delivered by real provider webhooks, and are never fabricated during mock calls.
4. **Data Isolation & Privacy**:
   - All agents and call records are strictly scoped to the authenticated user ID in PostgreSQL queries.
   - Recipient and caller phone numbers are consistently masked across both list and detail views (`+1 (415) ***-2671`) to protect user privacy.

