# Traceable Requirements Checklist & Verification Matrix

**Project:** AI Voice Agent Management System  
**Client/Submission Target:** Shiavnski Technologies, Indore  
**Author:** Senior Full-Stack Architect  
**Status:** Planning Phase — Blueprint Approved  
**Version:** 1.0.0  

---

## 1. System Overview & Requirement Classification

This checklist extracts every explicit and implicit requirement from the assignment specification. Each requirement is assigned:
- **Requirement ID**: Unique, traceable identifier (`REQ-<DOMAIN>-<NUM>`).
- **Classification**: `MANDATORY` (core assignment deliverable) or `OPTIONAL_ENHANCEMENT` (value-add / architectural showcase).
- **Target Implementation Phase**: Phase number mapping to `docs/IMPLEMENTATION_PLAN.md`.
- **Target Component**: Frontend (`FE`), Backend (`BE`), Database (`DB`), or Provider Layer (`PROVIDER`).
- **Verification Strategy**: The exact automated test and manual inspection step that proves requirement satisfaction.

---

## 2. Traceability Matrix

### 2.1 Authentication & User Session Management (`REQ-AUTH`)

| ID | Type | Requirement Description | Target | Phase | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-AUTH-01` | **MANDATORY** | User registration with unique email, strong password validation (min 8 chars, mixed case, number, symbol), and sanitized full name. | BE/FE/DB | Phase 2 | Unit test: password policy validation. Integration test: `POST /api/auth/register` creates hashed user record. |
| `REQ-AUTH-02` | **MANDATORY** | Secure password hashing using `bcrypt` (work factor 12) or `argon2id`. Plaintext passwords never logged or stored. | BE | Phase 2 | Unit test: verify hash cannot be reversed; bcrypt salt rounds check. |
| `REQ-AUTH-03` | **MANDATORY** | User login endpoint issuing signed JSON Web Tokens (JWT) with standard claims (`sub`, `email`, `iat`, `exp`). | BE | Phase 2 | Integration test: `POST /api/auth/login` returns valid JWT on correct credentials, rejects incorrect credentials with `401 Unauthorized`. |
| `REQ-AUTH-04` | **MANDATORY** | Secure token handling: tokens stored in `httpOnly`, `SameSite=Lax`, `Secure` cookies (or Authorization Bearer headers with safe memory storage) to mitigate XSS and CSRF. | BE/FE | Phase 2 | Integration test: verify cookie attributes or Bearer headers on auth response. |
| `REQ-AUTH-05` | **MANDATORY** | Authentication middleware (`requireAuth`) validating JWT signature, expiry, and active user status before granting access to protected routes. | BE | Phase 2 | Integration test: requests without token or with expired/tampered token return `401 Unauthorized`. |
| `REQ-AUTH-06` | **MANDATORY** | Frontend route protection: unauthenticated users accessing `/dashboard`, `/agents`, `/calls`, or `/call/new` are redirected to `/login` with return URL preservation. | FE | Phase 8 | E2E/Component test: unauthenticated navigation to `/dashboard` renders redirect to `/login`. |
| `REQ-AUTH-07` | **MANDATORY** | User logout functionality: clears auth cookies/tokens and invalidates client session state. | BE/FE | Phase 2 & 8 | Integration test: `POST /api/auth/logout` clears auth cookie and client state. |

---

### 2.2 Multi-Tenant User Isolation & Authorization (`REQ-AUTHZ`)

| ID | Type | Requirement Description | Target | Phase | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-AUTHZ-01` | **MANDATORY** | Multi-tenant user data boundary: all queries for agents, calls, and metrics must strictly filter by authenticated `userId`. | BE/DB | Phase 2-5 | Integration test: User A cannot retrieve User B's agents or calls (`GET /api/agents/:id` returns `404 Not Found` or `403 Forbidden`). |
| `REQ-AUTHZ-02` | **MANDATORY** | Prevention of cross-user agent assignment: initiating a call with an `agent_id` owned by another user must be rejected. | BE | Phase 5 | Integration test: `POST /api/calls` with User B's `agent_id` by User A returns `403 Forbidden`. |
| `REQ-AUTHZ-03` | **MANDATORY** | Webhook authorization scoping: webhooks updating calls must strictly resolve to the tenant who initiated or owns the call via `provider_call_id`. | BE | Phase 6 | Integration test: inbound webhook updates the specific call record without altering other tenants' records. |

---

### 2.3 Agent Management (`REQ-AGENT`)

| ID | Type | Requirement Description | Target | Phase | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-AGENT-01` | **MANDATORY** | Agent creation form: input name, description, system prompt / LLM instructions, voice selection, language locale, and responsiveness parameters. | FE/BE | Phase 4 & 8 | Integration test: `POST /api/agents` creates agent record in DB and syncs with provider. |
| `REQ-AGENT-02` | **MANDATORY** | External provider synchronization: creating an agent registers it with Retell AI (`POST /create-agent` or provider mock) and persists returned `provider_agent_id`. | BE/PROVIDER | Phase 4 | Integration test with Mock/Live Retell: agent creation returns valid `provider_agent_id` and sets `sync_status = "SYNCED"`. |
| `REQ-AGENT-03` | **MANDATORY** | Agent listing view: display all user's agents with name, voice, language, provider ID, sync status, and creation date. | FE/BE | Phase 4 & 8 | Integration test: `GET /api/agents` returns array of agents belonging strictly to current user. |
| `REQ-AGENT-04` | **MANDATORY** | Agent details view: view full prompt, model parameters, dynamic variables configuration, and linked call history. | FE/BE | Phase 4 & 8 | Integration test: `GET /api/agents/:id` returns comprehensive agent details. |
| `REQ-AGENT-05` | **MANDATORY** | Agent editing: update agent prompt, voice, and parameters; updates are propagated to Retell (`PATCH /update-agent/:id`) and updated locally. | FE/BE | Phase 4 & 8 | Integration test: `PUT /api/agents/:id` updates DB record and verifies provider update request. |
| `REQ-AGENT-06` | **MANDATORY** | Agent deletion with confirmation modal: user must explicitly confirm deletion; soft-deletes or deletes locally and triggers provider removal (`DELETE /delete-agent/:id`). | FE/BE | Phase 4 & 8 | Integration test: `DELETE /api/agents/:id` archives agent and removes provider link. Subsequent calls cannot use deleted agent. |
| `REQ-AGENT-07` | **MANDATORY** | Sync status indicators: clear UI badges for `SYNCED`, `PENDING_SYNC`, `SYNC_FAILED` with retry action if provider API is temporarily unavailable. | FE/BE | Phase 4 & 8 | Component test: UI displays colored badges for each sync state. |

---

### 2.4 Outbound Call Dispatching (`REQ-CALL`)

| ID | Type | Requirement Description | Target | Phase | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-CALL-01` | **MANDATORY** | Outbound call form: select active agent, specify recipient phone number, and optional dynamic variables (JSON / key-value pairs). | FE/BE | Phase 5 & 8 | Component test: form renders agent dropdown and dynamic variable inputs. |
| `REQ-CALL-02` | **MANDATORY** | Phone number validation: strict E.164 format verification (e.g., `+14155552671` or `+919876543210`) both on client and server. | FE/BE | Phase 5 | Unit test: E.164 regex and `libphonenumber-js` validation catches invalid numbers. |
| `REQ-CALL-03` | **MANDATORY** | Duplicate-submission protection: prevent rapid double-clicks using client button debouncing and an idempotency key (`X-Idempotency-Key` header) on backend. | FE/BE | Phase 5 & 8 | Integration test: concurrent identical requests within 5 seconds return existing call record rather than initiating duplicate outbound calls. |
| `REQ-CALL-04` | **MANDATORY** | Outbound dispatch execution: backend forwards call to Retell (`POST /v2/create-phone-call`) with `from_number`, `to_number`, `agent_id`, and dynamic variables. | BE/PROVIDER | Phase 5 | Integration test: call service sends correct payload to provider and captures returned `call_id`. |
| `REQ-CALL-05` | **MANDATORY** | Call record creation: immediately store call in database with status `INITIATED`/`REGISTERED`, capturing `provider_call_id`, `userId`, `agentId`, and timestamps. | BE/DB | Phase 5 | Integration test: verify call is saved with `provider_call_id` before returning `201 Created` to client. |
| `REQ-CALL-06` | **MANDATORY** | Outbound failure handling: if provider returns 4xx/5xx (e.g., invalid phone, insufficient credits, timeout), surface clear, actionable error to user. | BE/FE | Phase 5 & 8 | Integration test: simulate provider timeout/error; verify call record reflects `FAILED` status and returns user-friendly error. |

---

### 2.5 Call History, Details & Lifecycle Management (`REQ-HIST`)

| ID | Type | Requirement Description | Target | Phase | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-HIST-01` | **MANDATORY** | Call history table: paginated listing showing recipient number (masked in list view for privacy), agent name, status badge, duration, and timestamp. | FE/BE | Phase 7 & 8 | Integration test: `GET /api/calls?page=1&limit=10` returns paginated metadata and records. |
| `REQ-HIST-02` | **MANDATORY** | Search & filtering: filter calls by agent, call status (`INITIATED`, `ONGOING`, `ENDED`, `FAILED`), and date range (`startDate`, `endDate`). Search by phone number. | FE/BE | Phase 7 & 8 | Integration test: verify query parameters correctly filter DB results. |
| `REQ-HIST-03` | **MANDATORY** | Detailed call view: full unmasked phone number (authorized users only), agent details, complete call lifecycle timeline with micro-timestamps. | FE/BE | Phase 7 & 8 | Integration test: `GET /api/calls/:id` returns comprehensive call details. |
| `REQ-HIST-04` | **MANDATORY** | Call transcript display: full formatted conversation transcript with speaker roles (`agent` vs `user`), timestamped utterances, and sentiment tags. | FE/BE | Phase 7 & 8 | Component test: renders chat bubble or structured transcript view. |
| `REQ-HIST-05` | **MANDATORY** | Call summary & outcome: automated AI summary, call sentiment (`positive`, `neutral`, `negative`), completion status, and disconnection reason. | FE/BE | Phase 7 & 8 | Integration test: verify `call_analysis` fields are parsed and persisted from webhook payload. |
| `REQ-HIST-06` | **MANDATORY** | Secure audio recording access: embedded audio player with play/pause/scrub controls, rendering signed/authorized provider audio URLs. | FE/BE | Phase 7 & 8 | Component test: audio element loads recording URL when present. |
| `REQ-HIST-07` | **MANDATORY** | Masking in public lists: phone numbers in general listings masked as `+1 (***) ***-1234` or `+91 ***** **210` to avoid PII exposure. | FE/BE | Phase 7 | Unit test: phone masking utility preserves country code and last 3-4 digits only. |

---

### 2.6 Webhook Ingestion, Security & Resilience (`REQ-WH`)

| ID | Type | Requirement Description | Target | Phase | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-WH-01` | **MANDATORY** | Dedicated webhook endpoint: `POST /api/webhooks/retell` accepting incoming event notifications. | BE | Phase 6 | Integration test: endpoint accepts valid POST requests and returns HTTP 200/204 within 10 seconds. |
| `REQ-WH-02` | **MANDATORY** | Official signature verification: verify `X-Retell-Signature` using raw request body and `RETELL_API_KEY` via `Retell.verify()` HMAC-SHA256 scheme. | BE | Phase 6 | Integration test: valid signature succeeds; invalid or missing signature immediately returns `401 Unauthorized`. |
| `REQ-WH-03` | **MANDATORY** | Webhook raw body preservation: Express configured to capture unparsed raw request buffer specifically for webhook routes. | BE | Phase 6 | Unit test: verify raw body buffer matches transmitted payload byte-for-byte. |
| `REQ-WH-04` | **MANDATORY** | Event persistence & audit trail: all incoming webhook payloads logged to `webhook_events` table with headers, event type, timestamp, and processing status. | BE/DB | Phase 6 | Integration test: every received webhook produces an immutable record in `webhook_events`. |
| `REQ-WH-05` | **MANDATORY** | Deduplication & idempotency: deduplicate repeated webhook deliveries using unique constraint on `(provider, event_type, provider_call_id, timestamp)`. | BE/DB | Phase 6 | Integration test: sending duplicate webhook payload does not double-increment metrics or create redundant transitions. |
| `REQ-WH-06` | **MANDATORY** | Out-of-order event resilience: if `call_ended` arrives before local call record creation completes or before `call_started`, safely handle or provisionally upsert. | BE | Phase 6 | Integration test: simulate out-of-order delivery (`call_ended` before `call_started`); verify final DB state is consistent. |
| `REQ-WH-07` | **MANDATORY** | Unknown event handling: gracefully accept and acknowledge unknown future event types (`200 OK`) and mark as `IGNORED` without crashing. | BE | Phase 6 | Integration test: payload with `event: "custom_future_event"` returns `200 OK` and logs status `IGNORED`. |
| `REQ-WH-08` | **MANDATORY** | Safe error isolation: failure during event processing (e.g. analysis parsing failure) must not crash the server and must mark event as `FAILED` with error log. | BE | Phase 6 | Integration test: malformed inner JSON triggers transaction rollback and marks `webhook_events.status = "FAILED"`. |

---

### 2.7 Dashboard & Analytics (`REQ-DASH`)

| ID | Type | Requirement Description | Target | Phase | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-DASH-01` | **MANDATORY** | Dashboard KPI cards: Total Calls, Average Call Duration, Success Rate (%), and Active Agents count. | FE/BE | Phase 7 & 8 | Integration test: `GET /api/dashboard/metrics` returns computed aggregates scoped to user. |
| `REQ-DASH-02` | **MANDATORY** | Recent activity stream: quick-glance table of the 5 most recent calls with real-time status and quick link to details. | FE/BE | Phase 7 & 8 | Component test: renders recent calls list with correct links. |
| `REQ-DASH-03` | **MANDATORY** | Interactive dashboard filters: date range filter (Today, Last 7 Days, Last 30 Days, Custom Range) plus agent dropdown filter and status dropdown filter dynamically recomputing dashboard metrics. | FE/BE | Phase 7 & 8 | Integration test: `GET /api/dashboard/metrics` correctly filters aggregates by `startDate`, `endDate`, `agentId`, and `status`. |
| `REQ-DASH-04` | **OPTIONAL_ENHANCEMENT** | Visual charts: Call Volume over time (line/bar chart) and Call Sentiment breakdown (pie/donut chart) using pure SVG or lightweight chart library. | FE | Phase 8 | Component test: chart renders SVG elements without console errors. |

---

### 2.8 Database Schema, Integrity & Performance (`REQ-DB`)

| ID | Type | Requirement Description | Target | Phase | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-DB-01` | **MANDATORY** | 3NF normalized PostgreSQL schema: separate tables for `users`, `agents`, `calls`, `webhook_events`. | DB | Phase 1 | Prisma schema validation: `npx prisma validate` and migration generation succeed. |
| `REQ-DB-02` | **MANDATORY** | Foreign key constraints: `agents.user_id -> users.id`, `calls.user_id -> users.id`, `calls.agent_id -> agents.id`. | DB | Phase 1 | DB test: inserting orphan record violates foreign key constraint. |
| `REQ-DB-03` | **MANDATORY** | Deletion policies: cascading delete for user teardown, restricted delete on agents with linked call history (`onDelete: Restrict` or soft delete via `is_active: false`). | DB | Phase 1 | Integration test: deleting agent with existing calls retains historical call data. |
| `REQ-DB-04` | **MANDATORY** | Performance indexes: compound and single indexes on `(user_id, created_at)`, `provider_call_id`, `(status, user_id)`, `agent_id`. | DB | Phase 1 | DB schema inspection: verify index creation in migration SQL. |
| `REQ-DB-05` | **MANDATORY** | Unique constraints: unique `email` on `users`, unique `provider_call_id` on `calls`, unique idempotency keys. | DB | Phase 1 | DB test: duplicate unique insert throws constraint violation. |

---

### 2.9 Code Quality, Architecture & Provider Abstraction (`REQ-ARCH`)

| ID | Type | Requirement Description | Target | Phase | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-ARCH-01` | **MANDATORY** | Modular TypeScript architecture: strict separation of concerns into Routes, Controllers, Services, Repositories, Middlewares, and Schemas. | BE | Phase 1-7 | Code review & linting: `npm run lint` and `npm run typecheck` pass without errors. |
| `REQ-ARCH-02` | **MANDATORY** | Provider abstraction layer (`IVoiceProvider` interface): decoupling business logic from Retell API via Dependency Injection. | BE/PROVIDER | Phase 3 | Unit test: business service works identically with `MockVoiceProvider` and `RetellVoiceProvider`. |
| `REQ-ARCH-03` | **MANDATORY** | Mock provider implementation: fully simulated voice provider supporting agent CRUD, simulated outbound calls, and scripted webhook delivery. | BE/PROVIDER | Phase 3 | Integration test: complete application runs seamlessly without live Retell API credentials. |
| `REQ-ARCH-04` | **MANDATORY** | Centralized error handling middleware: maps known domain errors to standard HTTP status codes and formats unified JSON error responses `{ error: { code, message, details } }`. | BE | Phase 2 | Integration test: unhandled exceptions caught and sanitized (no stack traces leaked in production mode). |
| `REQ-ARCH-05` | **MANDATORY** | Comprehensive input validation: runtime validation using `Zod` on all request bodies, query parameters, and route params. | BE | Phase 2-7 | Unit/Integration test: invalid inputs return `400 Bad Request` with field-level error messages. |
| `REQ-ARCH-06` | **MANDATORY** | Environment variable management: validated config schema (`dotenv` + `zod`) failing fast on startup if mandatory variables are missing. | BE | Phase 1 | Unit test: server fails to boot if `DATABASE_URL` or `JWT_SECRET` is unset. |

---

### 2.10 Frontend User Experience & Aesthetics (`REQ-FE`)

| ID | Type | Requirement Description | Target | Phase | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-FE-01` | **MANDATORY** | Premium modern design system: curated dark/light harmonious palette, modern typography, glassmorphism cards, and fluid CSS transitions. | FE | Phase 8 | Visual inspection & component testing. |
| `REQ-FE-02` | **MANDATORY** | Complete UI state handling: explicit states for Loading (skeletons/spinners), Empty (contextual call-to-action), Error (retry prompt), and Success (toasts). | FE | Phase 8 | Component test: verify rendering for each state variant across all screens. |
| `REQ-FE-03` | **MANDATORY** | Fully responsive layout: mobile-first responsive navigation bar, flexible grid for cards, and horizontally scrolling or stacked tables on small viewports. | FE | Phase 8 | Responsive viewport testing (desktop, tablet, mobile). |
| `REQ-FE-04` | **OPTIONAL_ENHANCEMENT** | Simulated Webhook Trigger in UI: dev-tools panel allowing evaluators to simulate incoming `call_started`, `call_ended`, and `call_analyzed` webhooks in Mock Mode. | FE/BE | Phase 8 | Manual verification: click "Simulate Call Completion" -> call status updates to ENDED with transcript. |
| `REQ-FE-05` | **MANDATORY** | Persistent provider-mode badge: global navigation bar clearly indicates active telephony mode (`[PROVIDER: MOCK SIMULATION]` with amber status vs `[PROVIDER: RETELL LIVE]` with emerald status) ensuring synthetic data is never confused with live production integration. | FE | Phase 8 | Component test: Navbar renders amber badge in mock mode and emerald badge in live mode. |

---

### 2.11 Testing, Documentation & Submission Deliverables (`REQ-DELIV`)

| ID | Type | Requirement Description | Target | Phase | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-DELIV-01` | **MANDATORY** | Automated test suite: unit tests, integration tests for critical flows, and webhook ingestion tests achieving >80% coverage on core services. | TEST | Phase 9 | Run command: `npm run test` executes all suites and passes 100%. |
| `REQ-DELIV-02` | **MANDATORY** | Production README: comprehensive setup guide, architecture diagram, design decisions, API reference, mock mode usage, and Retell onboarding guide. | DOCS | Phase 10 | Manual inspection of `README.md`. |
| `REQ-DELIV-03` | **MANDATORY** | Clean `.env.example`: complete template with descriptive commentary, dummy placeholders, and zero leaked credentials. | CONFIG | Phase 1 | File inspection: verify no secrets committed. |
| `REQ-DELIV-04` | **MANDATORY** | Database migrations and seed script: automated Prisma migrations and `npm run db:seed` creating demo users, sample agents, and completed mock calls. | DB | Phase 1 | Run command: `npx prisma migrate dev` and `npm run db:seed` successfully populate database. |
| `REQ-DELIV-05` | **MANDATORY** | API documentation: OpenAPI / Swagger or Postman collection covering all endpoints. | DOCS | Phase 10 | File inspection: `docs/API_DOCUMENTATION.md` or `postman_collection.json`. |
| `REQ-DELIV-06` | **MANDATORY** | Honest documentation: clear distinction between live Retell operations, mock mode fallbacks, telephony requirements, and known limitations. | DOCS | Phase 10 | Manual inspection of Retell integration notes and README. |

---

## 3. Requirement Verification Summary & Classification Breakdown

### 3.1 Domain-by-Domain Distribution

| Category | Domain Key | Section | Mandatory | Optional | Total Items |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Functional / Application** | Authentication & Sessions (`REQ-AUTH`) | §2.1 | 7 | 0 | 7 |
| **Functional / Application** | Multi-Tenancy & Authorization (`REQ-AUTHZ`) | §2.2 | 3 | 0 | 3 |
| **Functional / Application** | Voice Agent Management (`REQ-AGENT`) | §2.3 | 7 | 0 | 7 |
| **Functional / Application** | Outbound Call Dispatching (`REQ-CALL`) | §2.4 | 6 | 0 | 6 |
| **Functional / Application** | Call History, Player & Details (`REQ-HIST`) | §2.5 | 7 | 0 | 7 |
| **Functional / Application** | Webhook Security & Ingestion (`REQ-WH`) | §2.6 | 8 | 0 | 8 |
| **Functional / Application** | Dashboard Analytics & Filters (`REQ-DASH`) | §2.7 | 3 | 1 | 4 |
| **Functional / Application** | Frontend UX, States & Badge (`REQ-FE`) | §2.10 | 4 | 1 | 5 |
| **Subtotal: Functional / Application** | | | **45** | **2** | **47** |
| **Technical / Foundation** | PostgreSQL Schema & Integrity (`REQ-DB`) | §2.8 | 5 | 0 | 5 |
| **Technical / Foundation** | TypeScript Architecture & Error Flow (`REQ-ARCH`) | §2.9 | 6 | 0 | 6 |
| **Deliverables & Submission** | Tests, Documentation & Setup (`REQ-DELIV`) | §2.11 | 6 | 0 | 6 |
| **Subtotal: Technical & Deliverables** | | | **17** | **0** | **17** |
| **GRAND TOTAL** | | | **62** | **2** | **64** |

### 3.2 Key Totals
- **Total Traceable Requirements with IDs:** **64**
- **Mandatory Requirements:** **62** (45 Functional + 17 Technical/Deliverables)
- **Optional Architectural Enhancements with IDs:** **2** (`REQ-DASH-04` Visual SVG Charts, `REQ-FE-04` Webhook Simulator Modal)
- **Additional Architectural Option (Un-enumerated):** 1 (Advanced PII transcript/recording scrubbing)
- **Unresolved / Pending Items:** **0** (All 64 items have designated implementation phases, target components, and verification test specifications).
