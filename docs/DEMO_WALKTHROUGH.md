# Shiavnski AI Voice Agent Management System - Demo Walkthrough & Evaluation Guide

This guide provides evaluators and reviewers with a quick, step-by-step walkthrough to evaluate both the interactive Web Console and the Backend REST API.

---

## 1. Quick Start with Pre-Seeded Demo Data

To populate demo agents, call records, and an administrator account immediately:

```powershell
# From the project root:
npm run seed
```

### Pre-Seeded Evaluation Account
- **URL**: `http://localhost:5173/login`
- **Email**: `demo@shiavnski.com`
- **Password**: `Password123!`

---

## 2. Interactive Web Console Walkthrough

### Step A: Operations Dashboard (`/`)
1. Log in with the demo account.
2. The Dashboard displays dynamic, database-calculated KPIs:
   - **Total Calls**: Total volume for the tenant.
   - **Avg Duration**: Real-time average duration in seconds.
   - **Success Rate**: Percentage of completed calls.
   - **Active Agents**: Count of active voice agents.
3. Test the interactive filters:
   - Filter by date range (e.g., Today, Last 7 Days, Last 30 Days).
   - Filter by specific Agent or Status (`INITIATED`, `ONGOING`, `ENDED`, `FAILED`).
   - Notice that both KPI cards and the **Recent Telephony Activity** table update dynamically.

### Step B: Voice Agent Management (`/agents`)
1. Navigate to **Voice Agents** via the sidebar.
2. View existing agents (`Healthcare Appointment Assistant`, `Customer Support Bot`) displaying provider badges and active statuses.
3. Click **"Create Agent"**:
   - Provide Name, Description, Voice ID, Language, System Prompt, Responsiveness, and Interruption Sensitivity.
   - Notice real-time client-side validation and responsive loading button indicators.
4. Click **"View Details"** or **"Edit"** to inspect or modify an agent's configuration.
5. Use the Search bar to filter agents by name or description.

### Step C: Dispatch an Outbound Call (`/call/new`)
1. Navigate to **Dispatch Call** in the sidebar.
2. Select an active agent from the dropdown.
3. Enter a destination phone number in E.164 format (e.g., `+1 415 555 2671`).
   - Note the validation preventing invalid numbers or letters.
4. Add custom dynamic prompt variables (e.g., `customer_name = John Doe`, `service_tier = VIP`).
5. Click **"Dispatch Outbound Call"**:
   - In `MOCK` mode, the system safely provisions a persisted call record with a unique `call_mock_*` ID.
   - An alert toast confirms dispatch and provides a quick link to the Call Records history.

### Step D: Call Records & Interactive Mock Simulation (`/calls`)
1. Navigate to **Call Records** in the sidebar.
2. The table displays call records with **masked phone numbers** (e.g. `+1 (415) ***-2671`) to protect caller privacy.
3. Click **"Details"** on any call to open the **Call Record Details Modal**:
   - Inspect call timestamps, caller ID, destination, and dynamic variables.
4. **Interactive Mock Simulation**:
   - If the call is `INITIATED`, click **"Simulate Pickup [MOCK]"** to transition the call to `ONGOING`.
   - Click **"Simulate Hangup [MOCK]"** to transition to `ENDED`.
   - The modal automatically refreshes and displays the persisted duration and disconnection reason (`simulated_user_hangup`).
   - Returning to the Dashboard reveals that the KPIs have updated to reflect the completed call!

---

## 3. Postman API Collection Testing

An importable Postman Collection is included in the repository at:
`docs/Shiavnski_Voice_Agent_API.postman_collection.json`

### How to Import:
1. Open **Postman** -> Click **Import**.
2. Select `docs/Shiavnski_Voice_Agent_API.postman_collection.json`.
3. The collection is organized into 5 folders:
   - **Health**: System health check (`GET /api/health`).
   - **Authentication**: Register, Login, Me, Logout.
   - **Voice Agents**: CRUD operations for multi-tenant agents.
   - **Call Management & Simulation**: Outbound dispatch, paginated listing, details, step simulation, and dynamic dashboard metrics.
   - **Telephony Provider & Webhooks**: Harmless Retell connectivity verification and cryptographically verified webhook ingestion.

---

## 4. Retell AI Telephony & Webhook Notes

1. **Default Mode (`PROVIDER_MODE="mock"`)**:
   - Designed for zero-cost, offline evaluation without third-party account requirements.
2. **Live Retell Integration**:
   - Backend provider abstraction integrates the official Retell SDK (`retell-sdk@6.2.11`).
   - Webhook signatures are verified using `Retell.verify(rawBody, signingKey, signature)`.
   - Webhook ingestion supports idempotency deduplication, out-of-order terminal state protection, and orphan event queuing.
   - To activate live mode in a production environment with paid Retell assets, configure `PROVIDER_MODE="retell"`, `RETELL_API_KEY`, `RETELL_FROM_NUMBER`, and route public webhooks via ngrok or public domain.
