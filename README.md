# ContextGrade

**Decision intelligence for onboarding, pricing, and trust.**

A B2B SaaS microservice that provides real-time decision intelligence by analyzing company context and generating AI-powered recommendations for onboarding, discount approvals, and payment terms.

## Product Positioning

ContextGrade is positioned as:
- **Decision intelligence for onboarding, pricing, and trust**
- **System of record for decisions** (not analytics)
- **In the execution path** (not background analysis)

## Architecture

```
CRM / Billing System
   | (webhook)
   v
Webhook Event Store (idempotency + replay)
   |
   v
Decision Trigger Service
   |
   v
Context Gatherer Agent
   |
   v
Decision Proposal Agent
   |
   v
Human Review UI (Future)
   |
   v
Decision Trace Store (Context Graph)
   |
   |-- Writeback to CRM
   '-- Precedent Search
```

## Tech Stack

- **Runtime**: Node.js 18+, TypeScript
- **Framework**: Fastify
- **Database**: Supabase Postgres (via Prisma ORM)
- **AI**: OpenAI (Anthropic supported)
- **Auth**: API Key-based (simple middleware)

## Project Structure

```
/src
  /server.ts              # Server entry point
  /app.ts                 # Fastify app configuration

  /config
    env.ts                # Environment configuration

  /modules
    /decisions            # Decisions domain module
      decisions.controller.ts
      decisions.service.ts
      decisions.repository.ts
      decisions.routes.ts
      decisions.types.ts

    /context              # Context gathering
      context.service.ts
      context.sources.ts

    /agents               # AI agents
      decisionProposal.agent.ts

  /db
    prisma.schema         # Database schema
    client.ts             # Prisma client

  /middleware
    auth.middleware.ts
    error.middleware.ts

  /utils
    logger.ts
    id.ts
```

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Supabase account (or PostgreSQL database)
- OpenAI API key (optional for development)

### Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required:
- `DATABASE_URL`: Your Supabase Postgres connection string
- `OPENAI_API_KEY`: Your OpenAI API key (optional for development)

3. **Set up database:**

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (development)
npm run db:push

# Or create a migration (production)
npm run db:migrate
```

4. **Start the server:**

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## API Endpoints

All endpoints require authentication via API key (see [Authentication](#authentication)).

---

### 1. Create Decision (Webhook Entry Point)

**POST** `/api/v1/decisions`

Creates a new decision by gathering context about a subject company and generating an AI recommendation. This is the primary webhook entry point for CRM / billing integrations.

**Request Body:**

```json
{
  "tenant_id": "uuid",
  "subject_company": {
    "external_id": "crm-abc-corp-123",
    "name": "ABC Corp",
    "domain": "https://abccorp.com",
    "industry": "Technology",
    "country": "USA",
    "metadata": {
      "source": "salesforce",
      "tags": ["enterprise", "new-lead"]
    }
  },
  "deal": {
    "crm_deal_id": "sf-12345",
    "amount": 50000,
    "currency": "USD",
    "discount_requested": 15
  },
  "decision_type": "DISCOUNT",
  "context_key": "payment_onboarding"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `tenant_id` | UUID | Yes | ContextGrade tenant (your organization) |
| `subject_company.external_id` | string | Yes | Your CRM/system identifier for the company being evaluated |
| `subject_company.name` | string | Yes | Company name |
| `subject_company.domain` | string | No | Company website URL |
| `subject_company.industry` | string | No | Industry vertical |
| `subject_company.country` | string | No | Country code or name |
| `subject_company.metadata` | object | No | Arbitrary extra data from your system |
| `deal.crm_deal_id` | string | No | CRM deal identifier (Salesforce, HubSpot, etc.) |
| `deal.amount` | number | No | Deal amount |
| `deal.currency` | string | No | Currency code (defaults to USD) |
| `deal.discount_requested` | number | No | Requested discount percentage (0-100) |
| `decision_type` | enum | Yes | One of: `DISCOUNT`, `ONBOARDING`, `PAYMENT_TERMS`, `CREDIT_EXTENSION`, `PARTNERSHIP`, `RENEWAL`, `ESCALATION`, `CUSTOM` |
| `context_key` | string | No | Key referencing a tenant-defined DecisionContext (e.g. `payment_onboarding`) |

**Response (201):**

```json
{
  "id": "decision-uuid",
  "tenant_id": "uuid",
  "subject_company_id": "uuid",
  "deal_id": "uuid",
  "context_key": "payment_onboarding",
  "decision_type": "DISCOUNT",
  "status": "PROPOSED",
  "urgency": "NORMAL",
  "recommended_action": "approve_with_conditions",
  "recommended_confidence": "MEDIUM",
  "suggested_conditions": [
    "Require upfront payment",
    "Limit discount to 10%"
  ],
  "recommendation": {
    "recommendation": "approve_with_conditions",
    "confidence": "medium",
    "rationale": [
      "Multiple recent complaints about delayed payments",
      "No prior purchasing history",
      "Similar company approved last quarter with prepay condition"
    ],
    "suggested_conditions": [
      "Require upfront payment",
      "Limit discount to 10%"
    ]
  },
  "context": {
    "signals": {
      "reddit_complaints": 5,
      "twitter_sentiment": "negative",
      "g2_rating": 2.8,
      "payment_history": "unknown"
    },
    "agent_rationale": "...",
    "agent_model": "gpt-4"
  },
  "subject_company": {
    "id": "uuid",
    "external_id": "crm-abc-corp-123",
    "name": "ABC Corp",
    "domain": "https://abccorp.com",
    "industry": "Technology",
    "country": "USA"
  },
  "overrides": [],
  "links": [],
  "created_at": "2026-02-07T00:00:00Z"
}
```

---

### 2. Review Decision (Human Action)

**POST** `/api/v1/decisions/:id/review`

Allows a human to approve, reject, override, or escalate a proposed decision. This is the human-in-the-loop step where decision traces are born.

**Request Body:**

```json
{
  "action": "override",
  "note": "Strategic logo win — accepting at reduced margin",
  "final_action": "approve_full_discount"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | enum | Yes | One of: `approve`, `reject`, `override`, `escalate` |
| `note` | string | No | Explanation for the action (stored as override reason) |
| `final_action` | string | No | Custom action text when overriding |

**Actions explained:**

| Action | Decision Status | Description |
|---|---|---|
| `approve` | `APPROVED` | Accept the AI recommendation as-is |
| `reject` | `REJECTED` | Decline the recommendation |
| `override` | `OVERRIDDEN` | Replace with a custom action (records override trace) |
| `escalate` | `ESCALATED` | Push to a higher authority for review |

**Response (200):** Returns the updated decision in the same format as the create endpoint.

---

### 3. Fetch Decision (Audit View)

**GET** `/api/v1/decisions/:id`

Retrieves a decision with its full context trace, including:
- Original AI recommendation and rationale
- Context snapshot (signals at decision time)
- Human overrides with reasons
- Linked precedent decisions
- Subject company details
- External source provenance

**Response (200):** Same format as the create endpoint response.

---

### Health Check

**GET** `/health`

Returns service health status.

```json
{
  "status": "ok",
  "timestamp": "2026-02-07T00:00:00Z"
}
```

## Authentication

Currently uses API key authentication via:
- Header: `X-API-Key: your-key`
- Header: `Authorization: Bearer your-key`
- Query: `?apiKey=your-key`

Set `API_KEY` in your `.env` file. If omitted, authentication is skipped (development only).

## Database Schema

The schema implements a multi-tenant decision trace store with the following core tables:

| Table | Description |
|---|---|
| `tenants` | ContextGrade's direct customers (B2B companies using the platform) |
| `users` | Humans within tenant orgs who make, review, or view decisions |
| `subject_companies` | Entities being evaluated (the tenant's clients/prospects) |
| `deals` | Revenue context anchoring decisions to deal value |
| `decision_contexts` | Tenant-defined context domains (e.g. payment_onboarding, hiring) |
| `decisions` | Immutable decision events — the atomic unit of truth |
| `decision_context_snapshots` | Time-travel: world state captured at decision time |
| `decision_human_overrides` | Human judgment traces (accountability + learning) |
| `decision_outcomes` | What actually happened after the decision (feedback loop) |
| `decision_links` | Precedent relationships forming the context graph |
| `external_sources` | Signal provenance tracking (auditability) |
| `policies` | Versioned decision rules (even informal ones) |
| `webhook_events` | Incoming webhook log for idempotency, debugging, and replay |

### Key Enums

| Enum | Values |
|---|---|
| `DecisionType` | `DISCOUNT`, `ONBOARDING`, `PAYMENT_TERMS`, `CREDIT_EXTENSION`, `PARTNERSHIP`, `RENEWAL`, `ESCALATION`, `CUSTOM` |
| `DecisionStatus` | `PROPOSED`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `OVERRIDDEN`, `EXPIRED`, `ESCALATED` |
| `DecisionConfidence` | `LOW`, `MEDIUM`, `HIGH`, `VERY_HIGH` |
| `DecisionUrgency` | `LOW`, `NORMAL`, `HIGH`, `CRITICAL` |
| `OutcomeType` | `PAID_ON_TIME`, `PAID_LATE`, `CHURNED`, `FRAUD`, `EXPANDED`, `DOWNGRADED`, `DEFAULTED`, `POSITIVE`, `NEGATIVE`, `NEUTRAL` |
| `RelationshipType` | `PRECEDENT`, `SIMILAR_CASE`, `POLICY_EXCEPTION`, `CONTRADICTS`, `SUPPORTS`, `FOLLOW_UP` |
| `SourceType` | `REDDIT`, `TWITTER`, `G2`, `TRUSTPILOT`, `NEWS`, `GOOGLE_SEARCH`, `WEBSITE`, `LINKEDIN`, `CRUNCHBASE`, `COURT_RECORDS`, `FINANCIAL_FILINGS`, `GLASSDOOR`, `GITHUB`, `CUSTOM` |
| `ContextCategory` | `PAYMENT`, `ONBOARDING`, `HIRING`, `COMPLIANCE`, `ENGINEERING`, `SALES`, `PARTNERSHIP`, `SECURITY`, `CUSTOM` |

See `prisma/schema.prisma` for complete schema definition.

## Core Domain Rules

1. **Decisions are immutable events**
   - You may update status
   - You may append overrides and outcomes
   - You may not delete decisions

2. **Context is snapshot-based**
   - Context is captured at decision time
   - Never recompute past context

3. **AI recommendations are advisory**
   - Humans make final decisions
   - Overrides must be explainable

4. **No numeric scores**
   - Use recommendations + rationale
   - Avoid numeric credibility scores

5. **Subject companies are identified by externalId**
   - Each tenant provides their own CRM identifier
   - All decisions for the same `external_id` are linked automatically
   - Unique per tenant: `(tenant_id, external_id)`

6. **Decision contexts are tenant-defined**
   - Contexts like `payment_onboarding`, `hiring`, `coding_practices` are scoped per tenant
   - Long-term: context traces become exportable knowledge (skills.md)

## Roadmap (V2+)

- [ ] Reddit API integration
- [ ] Twitter/X API integration
- [ ] G2 and Trustpilot integration
- [ ] Financial health APIs (Crunchbase, court records)
- [ ] Precedent search by similarity (embeddings)
- [ ] Decision outcome tracking + feedback loop
- [ ] Human Review UI
- [ ] Webhook writeback to CRM
- [ ] Context graph promotion (AGE Postgres extension)
- [ ] OAuth/JWT authentication
- [ ] Context-to-skills.md export for foresight decisions

## Development

### Scripts

- `npm run dev`: Start development server with hot reload
- `npm run build`: Build TypeScript to JavaScript
- `npm start`: Start production server
- `npm run db:generate`: Generate Prisma client
- `npm run db:push`: Push schema changes (dev)
- `npm run db:migrate`: Create migration (prod)
- `npm run db:studio`: Open Prisma Studio

### Code Style

- TypeScript strict mode enabled
- ESLint configuration recommended
- Prefer clarity over cleverness
- Comments explain WHY, not WHAT

## Troubleshooting

**Database connection errors:**
- Verify `DATABASE_URL` is correct
- Ensure SSL mode is set if using Supabase
- Check network connectivity

**AI recommendation failures:**
- Verify `OPENAI_API_KEY` is set
- Check API quota/limits
- Service falls back to `review_manually` if AI unavailable

**Authentication issues:**
- In development, `API_KEY` can be omitted
- Ensure header format is correct
- Check logs for detailed error messages

## License

MIT

---

**Built for decision intelligence**
