# Phased Implementation Plan & Execution Roadmap

**Project:** AI Voice Agent Management System  
**Organization:** Shiavnski Technologies Developer Assignment  
**Architect:** Senior Full-Stack Architect  
**Methodology:** Test-Driven, Contract-First Architecture  
**Status:** Approved for Implementation  

---

## 1. Execution Overview & Phase Roadmap

The implementation is broken down into 10 structured, progressive phases. Each phase is self-contained with clear entry prerequisites, requirements traceability, concrete deliverables, verification commands, and non-negotiable exit criteria.

```mermaid
graph LR
    P0[Phase 0<br/>Scaffolding & Config] --> P1[Phase 1<br/>Database & Prisma]
    P1 --> P2[Phase 2<br/>Auth & Tenancy]
    P2 --> P3[Phase 3<br/>Provider & Mock Engine]
    P3 --> P4[Phase 4<br/>Agent Management]
    P4 --> P5[Phase 5<br/>Outbound Call Flow]
    P5 --> P6[Phase 6<br/>Webhook Ingestion]
    P6 --> P7[Phase 7<br/>Call History & Metrics]
    P7 --> P8[Phase 8<br/>React Frontend]
    P8 --> P9[Phase 9<br/>E2E Tests & Polish]
    P9 --> P10[Phase 10<br/>Docs & Submission]
```

---

## Phase 0: Project Scaffolding & Environment Configuration

### 0.1 Objectives & Requirements Covered
- **Requirements Covered:** `REQ-ARCH-01`, `REQ-ARCH-06`, `REQ-DELIV-03`.
- Establish monorepo structure, TypeScript configs, ESLint, Prettier, `.env.example`, and package scripts.

### 0.2 Modules & Files to Create
- `/package.json` (Workspace root)
- `/backend/package.json`, `/backend/tsconfig.json`
- `/backend/.env.example`
- `/backend/src/config/index.ts` (Zod environment validator)
- `/frontend/package.json`, `/frontend/tsconfig.json`, `/frontend/vite.config.ts`
- `/frontend/.env.example`

### 0.3 Implementation Tasks
1. Initialize backend with TypeScript, Express, `dotenv`, `zod`, `cors`, `helmet`, `morgan`.
2. Configure environment schema in `backend/src/config/index.ts` checking for:
   `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PROVIDER_MODE`, `RETELL_API_KEY`.
3. Initialize React + Vite frontend with TypeScript.

### 0.4 Commands to Execute
```bash
# Backend build & lint check
cd backend && npm run build
# Frontend build check
cd ../frontend && npm run build
```

### 0.5 Automated Tests & Verification
- **Test:** `backend/tests/unit/config.test.ts`
- **Expected Result:** Throws descriptive validation error if `DATABASE_URL` is missing; parses valid `.env`.

### 0.6 Exit Criteria
- Both backend and frontend compile with zero TypeScript errors.
- Environment variables fail fast if required secrets are missing.

---

## Phase 1: Database Setup & Prisma Migrations

### 1.1 Objectives & Requirements Covered
- **Requirements Covered:** `REQ-DB-01`, `REQ-DB-02`, `REQ-DB-03`, `REQ-DB-04`, `REQ-DB-05`, `REQ-DELIV-04`.
- Setup normalized PostgreSQL schemas, foreign keys, indexes, migrations, and seed script.

### 1.2 Modules & Files to Create
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/`
- `backend/prisma/seed.ts`
- `backend/src/utils/prisma.ts` (PrismaClient singleton)

### 1.3 Implementation Tasks
1. Define schema according to `docs/DATABASE_DESIGN.md` (`User`, `Agent`, `Call`, `WebhookEvent`).
2. Run Prisma migration to generate SQL schema and TypeScript Prisma client.
3. Write seed script creating 2 demo users (`demo@shiavnski.com`, `reviewer@shiavnski.com`), 3 sample agents, and 5 historical calls with transcripts and audio links.

### 1.4 Commands to Execute
```bash
cd backend
npx prisma validate
npx prisma migrate dev --name init_schema
npx prisma db seed
```

### 1.5 Automated Tests & Verification
- **Test:** `backend/tests/integration/db_constraints.test.ts`
- **Expected Result:** Confirms foreign key enforcement, unique email constraint, and soft deletion constraints.

### 1.6 Exit Criteria
- PostgreSQL database migrated and seeded successfully.
- Generated Prisma client exports all model types.

---

## Phase 2: Authentication & Multi-Tenant Authorization

### 2.1 Objectives & Requirements Covered
- **Requirements Covered:** `REQ-AUTH-01` to `REQ-AUTH-07`, `REQ-AUTHZ-01`, `REQ-ARCH-04`, `REQ-ARCH-05`.
- User registration, password hashing (`bcrypt`), JWT token issue/verify, `requireAuth` middleware, and centralized error handling.

### 2.2 Modules & Files to Create
- `backend/src/utils/password.util.ts`, `backend/src/utils/jwt.util.ts`
- `backend/src/middleware/auth.middleware.ts`, `backend/src/middleware/error.middleware.ts`, `backend/src/middleware/validate.middleware.ts`
- `backend/src/schemas/auth.schema.ts`
- `backend/src/repositories/user.repository.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/controllers/auth.controller.ts`
- `backend/src/routes/auth.routes.ts`

### 2.3 Implementation Tasks
1. Implement password hashing utility with `bcrypt` (12 rounds).
2. Implement JWT token signing and verification with expiration handling.
3. Build Zod validation schemas for registration and login bodies.
4. Implement `requireAuth` middleware attaching `req.user = { id, email, role }`.
5. Implement centralized error handler translating domain errors (`UnauthorizedError`, `NotFoundError`, `ConflictError`, `ValidationError`) into standardized JSON responses.

### 2.4 Commands to Execute
```bash
cd backend
npm run test -- tests/integration/auth.test.ts
```

### 2.5 Automated Tests & Expected Results
- Register: Valid payload returns `201 Created` and user without password hash.
- Register duplicate: Returns `409 Conflict`.
- Login valid: Returns `200 OK` with auth token.
- Login invalid: Returns `401 Unauthorized`.
- Protected route without token: Returns `401 Unauthorized`.

### 2.6 Exit Criteria
- All auth unit and integration tests passing 100%.

---

## Phase 3: Provider Abstraction & Deterministic Mock Engine

### 3.1 Objectives & Requirements Covered
- **Requirements Covered:** `REQ-ARCH-02`, `REQ-ARCH-03`, `REQ-WH-02`.
- Define `IVoiceProvider` interface and implement both `RetellVoiceProvider` (real SDK) and `MockVoiceProvider` (zero-credential simulator).

### 3.2 Modules & Files to Create
- `backend/src/providers/voice-provider.interface.ts`
- `backend/src/providers/retell.provider.ts`
- `backend/src/providers/mock.provider.ts`
- `backend/src/providers/index.ts` (Factory)

### 3.3 Implementation Tasks
1. Define `IVoiceProvider` contract for agent CRUD, outbound call dispatch, call retrieval, and HMAC verification.
2. Implement `RetellVoiceProvider` using `retell-sdk`.
3. Implement `MockVoiceProvider` with realistic synthetic response generation (formatted `call_id`s, simulated realistic conversation transcripts, audio samples, and HMAC signature generator for mock webhook testing).

### 3.4 Commands to Execute
```bash
cd backend
npm run test -- tests/unit/provider.test.ts
```

### 3.5 Automated Tests & Expected Results
- `MockVoiceProvider.createAgent` returns mock `agent_id`.
- `MockVoiceProvider.createPhoneCall` returns mock `call_id` and initial status `registered`.
- `MockVoiceProvider.verifyWebhookSignature` correctly validates test HMAC signatures.

### 3.6 Exit Criteria
- Core system decoupled from direct SDK imports; factory smoothly resolves provider via `PROVIDER_MODE`.

---

## Phase 4: Agent Management Module

### 4.1 Objectives & Requirements Covered
- **Requirements Covered:** `REQ-AGENT-01` to `REQ-AGENT-07`, `REQ-AUTHZ-01`.
- Complete CRUD operations for voice agents with provider synchronization and tenant scoping.

### 4.2 Modules & Files to Create
- `backend/src/schemas/agent.schema.ts`
- `backend/src/repositories/agent.repository.ts`
- `backend/src/services/agent.service.ts`
- `backend/src/controllers/agent.controller.ts`
- `backend/src/routes/agent.routes.ts`

### 4.3 Implementation Tasks
1. Input validation for agent parameters (name, voice, language, prompt, responsiveness).
2. Sync agent creation with `IVoiceProvider.createAgent()`.
3. List agents strictly scoped to `req.user.id`.
4. Update agent details and propagate changes to provider (`updateAgent`).
5. Soft-delete agent and notify provider (`deleteAgent`).

### 4.4 Commands to Execute
```bash
cd backend
npm run test -- tests/integration/agent.test.ts
```

### 4.5 Automated Tests & Expected Results
- `POST /api/agents` creates agent and stores `provider_agent_id`.
- `GET /api/agents` returns only agents owned by authenticated user.
- Cross-tenant test: User B cannot edit or delete User A's agent (returns `404 Not Found`).

### 4.6 Exit Criteria
- Complete agent lifecycle verified with both `MockVoiceProvider` and mocked SDK calls.

---

## Phase 5: Outbound Call Dispatch Module

### 5.1 Objectives & Requirements Covered
- **Requirements Covered:** `REQ-CALL-01` to `REQ-CALL-06`, `REQ-AUTHZ-02`.
- Outbound call initiation, strict E.164 phone validation, duplicate call protection, and provider dispatch.

### 5.2 Modules & Files to Create
- `backend/src/utils/phone.util.ts`
- `backend/src/schemas/call.schema.ts`
- `backend/src/repositories/call.repository.ts`
- `backend/src/services/call.service.ts`
- `backend/src/controllers/call.controller.ts`
- `backend/src/routes/call.routes.ts`

### 5.3 Implementation Tasks
1. Implement E.164 phone validator ensuring country code and valid digits.
2. Verify agent ownership before placing call (reject cross-user agent hijacking).
3. Implement 5-second duplicate dispatch lockout using client idempotency key or call hash.
4. Call `provider.createPhoneCall()` and persist new call with `status = INITIATED`.
5. Return clean call object to client with status and `call_id`.

### 5.4 Commands to Execute
```bash
cd backend
npm run test -- tests/integration/call_dispatch.test.ts
```

### 5.5 Automated Tests & Expected Results
- Invalid phone number (`"12345"`) returns `400 Bad Request`.
- Legitimate dispatch creates record with status `INITIATED` and returns `201 Created`.
- Rapid duplicate dispatch within 5 seconds returns existing record without re-dispatching.
- Attempting to call using another tenant's agent returns `403 Forbidden`.

### 5.6 Exit Criteria
- Outbound calls dispatched safely and recorded reliably in database.

---

## Phase 6: Webhook Ingestion, Security & Resilience

### 6.1 Objectives & Requirements Covered
- **Requirements Covered:** `REQ-WH-01` to `REQ-WH-08`, `REQ-AUTHZ-03`.
- Dedicated webhook endpoint, raw-body HMAC signature verification, event persistence, deduplication, and out-of-order state transitions.

### 6.2 Modules & Files to Create
- `backend/src/middleware/rawBody.middleware.ts`
- `backend/src/schemas/webhook.schema.ts`
- `backend/src/repositories/webhook.repository.ts`
- `backend/src/services/webhook.service.ts`
- `backend/src/controllers/webhook.controller.ts`
- `backend/src/routes/webhook.routes.ts`

### 6.3 Implementation Tasks
1. Configure raw-body capture on `/api/webhooks` route.
2. Implement signature verification using `IVoiceProvider.verifyWebhookSignature()`.
3. Ingest and persist every event into `webhook_events`.
4. State machine handlers:
   - `call_started` -> Update call status to `ONGOING`, set `started_at`.
   - `call_ended` -> Update status to `ENDED`, set duration, transcript, recording URL.
   - `call_analyzed` -> Merge `summary`, `sentiment`, `call_successful`, and custom analysis data.
5. Deduplication check: duplicate deliveries logged as `DUPLICATE` without state regression.
6. Unknown event handler: logs as `IGNORED` and returns `200 OK`.

### 6.4 Commands to Execute
```bash
cd backend
npm run test -- tests/integration/webhook.test.ts
```

### 6.5 Automated Tests & Expected Results
- Missing/invalid signature returns `401 Unauthorized`.
- Valid `call_started`, `call_ended`, `call_analyzed` sequence updates call state accurately.
- Duplicate payload does not cause errors or redundant transitions.
- Out-of-order delivery (`call_ended` before `call_started`) gracefully resolves to `ENDED`.

### 6.6 Exit Criteria
- All webhook failure modes, security checks, and deduplication scenarios tested and green.

---

## Phase 7: Call History, Analytics & Dashboard Metrics

### 7.1 Objectives & Requirements Covered
- **Requirements Covered:** `REQ-HIST-01` to `REQ-HIST-07`, `REQ-DASH-01` to `REQ-DASH-04`.
- Paginated call history, search & filter endpoints, call detail view with transcript and recording, and aggregate dashboard metrics.

### 7.2 Modules & Files to Create
- `backend/src/services/dashboard.service.ts`
- `backend/src/controllers/dashboard.controller.ts`
- `backend/src/routes/dashboard.routes.ts`
- Updates to `call.service.ts` and `call.controller.ts` for filtering & pagination.

### 7.3 Implementation Tasks
1. Implement `GET /api/calls` with pagination (`page`, `limit`), search query, agent filter, status filter, and date range.
2. Implement phone masking utility in list responses (`+1 (***) ***-1234`).
3. Implement `GET /api/calls/:id` returning full unmasked details, transcript turns, audio URLs, and AI summary.
4. Implement `GET /api/dashboard/metrics` computing:
   - Total Calls
   - Average Duration (seconds)
   - Success Rate (%)
   - Active Agents count
   - Recent 5 calls feed

### 7.4 Commands to Execute
```bash
cd backend
npm run test -- tests/integration/dashboard_metrics.test.ts
```

### 7.5 Automated Tests & Expected Results
- Paginated queries return correct count and page chunks.
- Metrics accurately reflect tenant's call statistics.
- Cross-tenant isolation verified on call details.

### 7.6 Exit Criteria
- All backend REST endpoints completed, tested, and documented.

---

## Phase 8: Modern React Frontend Application

### 8.1 Objectives & Requirements Covered
- **Requirements Covered:** `REQ-FE-01` to `REQ-FE-05`, `REQ-AUTH-06`, `REQ-AGENT-01`, `REQ-CALL-01`, `REQ-HIST-01` to `REQ-HIST-06`, `REQ-DASH-01` to `REQ-DASH-04`.
- High-performance, aesthetically stunning React SPA with modern CSS, state feedback, responsive layouts, audio player, persistent provider badge, and simulation tools.

### 8.2 Modules & Files to Create
- Design system: `frontend/src/styles/variables.css`, `frontend/src/styles/index.css`
- API client & interceptors: `frontend/src/api/client.ts`
- Context: `AuthContext.tsx`, `NotificationContext.tsx`
- Layout components: `Navbar.tsx` (with persistent Provider Mode Badge), `Sidebar.tsx`, `Container.tsx`
- Core Pages:
  - `LoginPage.tsx`, `RegisterPage.tsx`
  - `DashboardPage.tsx` (KPI cards, trends, recent calls, date/agent/status filters)
  - `AgentsPage.tsx` & `AgentFormModal.tsx` (Listing, Create/Edit, Delete modal)
  - `NewCallPage.tsx` (Outbound call form, phone validator, dynamic variables)
  - `CallsPage.tsx` (Filterable, paginated data table)
  - `CallDetailPage.tsx` (Audio player, sentiment badge, transcript viewer)
  - `WebhookSimulatorModal.tsx` (Mock helper for evaluator testing)

### 8.3 Implementation Tasks
1. Build design tokens (harmonious dark/light theme, custom glassmorphism styles, typography).
2. Wire authentication flow with route guards (`ProtectedRoute`).
3. Implement Navbar featuring persistent Provider Mode Badge (`[PROVIDER: MOCK SIMULATION]` vs `[PROVIDER: RETELL LIVE]`).
4. Implement Agent management views with loading skeletons and confirmation modals.
5. Implement Outbound Call console with instant phone validation and double-click prevention.
6. Implement interactive Call Details page featuring custom audio player and turn-by-turn chat transcript.
7. Build Dashboard with animated KPI counters, SVG charts, and reactive date/agent/status filters.
8. Integrate optional Webhook Simulation helper for seamless evaluation in mock mode.

### 8.4 Commands to Execute
```bash
cd frontend
npm run lint
npm run build
```

### 8.5 Manual Verification Steps
1. Navigate to `/register` -> create account -> automatic login to `/dashboard`.
2. Navigate to `/agents` -> create agent "Sales Rep" -> badge shows `SYNCED`.
3. Navigate to `/call/new` -> select "Sales Rep" -> submit valid phone -> redirected to `/calls/:id`.
4. Trigger simulated webhook completion -> audio player and transcript populate dynamically.

### 8.6 Exit Criteria
- Frontend runs smoothly with zero console errors, responsive on mobile and desktop.

---

## Phase 9: End-to-End Verification & Automated Test Suite

### 9.1 Objectives & Requirements Covered
- **Requirements Covered:** `REQ-DELIV-01`.
- Execute full regression testing across backend and frontend.

### 9.2 Modules & Files to Create
- `backend/tests/e2e/call_lifecycle.test.ts`
- `backend/tests/integration/cross_tenant_security.test.ts`

### 9.3 Implementation Tasks
1. Run complete test suite covering:
   - Registration, login, bad password, expired tokens.
   - Cross-user tenant boundary enforcement.
   - Agent CRUD and sync status transitions.
   - Outbound call dispatch, error handling, and duplicate lockout.
   - Webhook signature validation, duplicate dropping, out-of-order recovery.
   - Pagination, search, and dashboard aggregation.
2. Measure test coverage across services and repositories.

### 9.4 Commands to Execute
```bash
# Run all backend tests
cd backend && npm run test:coverage
```

### 9.5 Exit Criteria
- 100% of automated tests pass; zero unhandled promise rejections.

---

## Phase 10: Documentation, Demonstration Artifacts & Submission

### 10.1 Objectives & Requirements Covered
- **Requirements Covered:** `REQ-DELIV-02`, `REQ-DELIV-05`, `REQ-DELIV-06`.
- Create production-ready `README.md`, API documentation, Retell onboarding guide, and evaluation instructions.

### 10.2 Deliverables to Finalize
- `README.md` (Architecture, quickstart, mock mode, live mode, API docs)
- `docs/API_DOCUMENTATION.md` (OpenAPI-style endpoint guide)
- Screenshots / UI Walkthrough in `docs/screenshots/`
- Clean repository with zero secrets in Git history.

### 10.3 Exit Criteria
- Complete assignment package ready for submission to Shiavnski Technologies.
