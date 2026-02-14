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

### Environment Isolation

ContextGrade uses **infrastructure-level environment isolation** — sandbox and production run the same schema against separate Supabase instances and endpoints.

| File | Purpose | Endpoint |
|---|---|---|
| `.env` | Local development (default) | `localhost:3000` |
| `.env.sandbox` | Sandbox Supabase instance | `sandbox.contextgrade.com` |
| `.env.prod` | Production Supabase instance | `api.contextgrade.com` |

Each file has its own `DATABASE_URL` pointing to a different Supabase project.

3. **Set up database:**

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (development)
npm run db:push

# Or create a migration (development)
npm run db:migrate -- --name initial_schema

# Deploy migrations to sandbox
npm run db:migrate:sandbox -- --name initial_schema

# Deploy migrations to production
npm run db:migrate:prod
```

You can also use `dotenv-cli` directly:

```bash
npx dotenv -e .env.sandbox -- npx prisma migrate dev --name my_migration
npx dotenv -e .env.prod -- npx prisma migrate deploy
```

4. **Start the server:**

```bash
# Development (with hot reload, uses .env)
npm run dev

# Development against sandbox DB
npm run dev:sandbox

# Production
npm run build
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

---

## API Endpoints

**Base URL**: `/api/v1`

All endpoints require authentication via API key (see [Authentication](#authentication)).

---

### Health Check

```
GET /health
```

Returns service health status. No authentication required.

**Sample Request:**

```bash
curl http://localhost:3000/health
```

**Sample Response (200):**

```json
{
  "status": "ok",
  "service": "contextgrade",
  "version": "0.1.0",
  "timestamp": "2026-02-12T10:30:00.000Z"
}
```

---

### 1. Create Decision

```
POST /api/v1/decisions
```

Creates a new decision by gathering context about a subject company and generating an AI recommendation. This is the primary webhook entry point for CRM / billing integrations.

**Headers:**

```
X-API-Key: your-api-key
Content-Type: application/json
```

**Sample Request:**

```bash
curl -X POST http://localhost:3000/api/v1/decisions \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "subject_company": {
      "external_id": "crm-acme-corp-001",
      "name": "Acme Corp",
      "domain": "https://acmecorp.com",
      "industry": "Financial Services",
      "country": "USA",
      "metadata": {
        "source": "salesforce",
        "tags": ["enterprise", "new-lead"]
      }
    },
    "deal": {
      "crm_deal_id": "sf-deal-98765",
      "amount": 50000,
      "currency": "USD",
      "discount_requested": 15
    },
    "decision_type": "DISCOUNT",
    "context_key": "payment_onboarding"
  }'
```

**Request Body Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `client_id` | UUID | Yes | ContextGrade client (your organization) |
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
| `context_key` | string | No | Key referencing a client-defined DecisionContext (e.g. `payment_onboarding`) |

**Sample Response (201):**

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "client_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "subject_company_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "deal_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "context_key": "payment_onboarding",
  "decision_type": "DISCOUNT",
  "status": "PROPOSED",
  "urgency": "NORMAL",
  "summary": "Acme Corp discount request",
  "recommended_action": "approve_with_conditions",
  "recommended_confidence": "MEDIUM",
  "suggested_conditions": [
    "Require upfront payment",
    "Limit discount to 10%"
  ],
  "created_at": "2026-02-12T10:30:00.000Z",
  "recommendation": {
    "recommendation": "approve_with_conditions",
    "confidence": "medium",
    "rationale": [
      "Strong company growth signals in financial services sector",
      "No prior purchasing history with this client",
      "Similar company approved last quarter with prepay condition"
    ],
    "suggested_conditions": [
      "Require upfront payment",
      "Limit discount to 10%"
    ]
  },
  "context": {
    "signals": {
      "website_analysis": {
        "company_size": "500+ employees",
        "industry": "Financial Services",
        "growth_signal": "strong"
      },
      "reddit_mentions": 3,
      "trustpilot_rating": 4.2,
      "news_sentiment": "positive"
    },
    "agent_rationale": "Strong company growth signals in financial services sector\nNo prior purchasing history with this client\nSimilar company approved last quarter with prepay condition",
    "agent_model": "gpt-4"
  },
  "subject_company": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "external_id": "crm-acme-corp-001",
    "name": "Acme Corp",
    "domain": "https://acmecorp.com",
    "industry": "Financial Services",
    "country": "USA"
  },
  "overrides": [],
  "links": []
}
```

---

### 2. Review Decision (Human Action)

```
POST /api/v1/decisions/:id/review
```

Allows a human to approve, reject, override, or escalate a proposed decision. This is the human-in-the-loop step where decision traces are born.

**Headers:**

```
X-API-Key: your-api-key
Content-Type: application/json
```

#### Example: Approve with AI reasoning

**Sample Request:**

```bash
curl -X POST http://localhost:3000/api/v1/decisions/f47ac10b-58cc-4372-a567-0e02b2c3d479/review \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "note": "AI reasoning looks solid, approving as-is"
  }'
```

**Sample Response (200):**

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "client_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "subject_company_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "deal_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "context_key": "payment_onboarding",
  "decision_type": "DISCOUNT",
  "status": "APPROVED",
  "urgency": "NORMAL",
  "summary": "Acme Corp discount request",
  "recommended_action": "approve_with_conditions",
  "recommended_confidence": "MEDIUM",
  "suggested_conditions": [
    "Require upfront payment",
    "Limit discount to 10%"
  ],
  "final_action": "approve_with_conditions",
  "decided_by": "d4e5f6a7-b8c9-0123-defg-234567890123",
  "created_at": "2026-02-12T10:30:00.000Z",
  "decided_at": "2026-02-12T10:35:00.000Z",
  "recommendation": {
    "recommendation": "approve_with_conditions",
    "confidence": "medium",
    "rationale": [
      "Strong company growth signals in financial services sector",
      "No prior purchasing history with this client",
      "Similar company approved last quarter with prepay condition"
    ],
    "suggested_conditions": [
      "Require upfront payment",
      "Limit discount to 10%"
    ]
  },
  "context": {
    "signals": {
      "website_analysis": {
        "company_size": "500+ employees",
        "industry": "Financial Services",
        "growth_signal": "strong"
      },
      "reddit_mentions": 3,
      "trustpilot_rating": 4.2,
      "news_sentiment": "positive"
    },
    "agent_rationale": "Strong company growth signals in financial services sector\nNo prior purchasing history with this client\nSimilar company approved last quarter with prepay condition",
    "agent_model": "gpt-4"
  },
  "subject_company": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "external_id": "crm-acme-corp-001",
    "name": "Acme Corp",
    "domain": "https://acmecorp.com",
    "industry": "Financial Services",
    "country": "USA"
  },
  "decided_by_user": {
    "id": "d4e5f6a7-b8c9-0123-defg-234567890123",
    "name": "Sarah Chen",
    "title": "VP Sales"
  },
  "overrides": [],
  "links": []
}
```

#### Example: Override the AI recommendation

**Sample Request:**

```bash
curl -X POST http://localhost:3000/api/v1/decisions/f47ac10b-58cc-4372-a567-0e02b2c3d479/review \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "override",
    "note": "Strategic logo win — accepting at reduced margin, multi-year potential",
    "final_action": "Approved 20% discount"
  }'
```

**Sample Response (200):**

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "client_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "subject_company_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "deal_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "context_key": "payment_onboarding",
  "decision_type": "DISCOUNT",
  "status": "OVERRIDDEN",
  "urgency": "NORMAL",
  "summary": "Acme Corp discount request",
  "recommended_action": "approve_with_conditions",
  "recommended_confidence": "MEDIUM",
  "suggested_conditions": [
    "Require upfront payment",
    "Limit discount to 10%"
  ],
  "final_action": "Approved 20% discount",
  "decided_by": "d4e5f6a7-b8c9-0123-defg-234567890123",
  "created_at": "2026-02-12T10:30:00.000Z",
  "decided_at": "2026-02-12T10:40:00.000Z",
  "recommendation": {
    "recommendation": "approve_with_conditions",
    "confidence": "medium",
    "rationale": [
      "Strong company growth signals in financial services sector",
      "No prior purchasing history with this client",
      "Similar company approved last quarter with prepay condition"
    ]
  },
  "context": {
    "signals": {
      "website_analysis": {
        "company_size": "500+ employees",
        "industry": "Financial Services",
        "growth_signal": "strong"
      },
      "reddit_mentions": 3,
      "trustpilot_rating": 4.2,
      "news_sentiment": "positive"
    },
    "agent_rationale": "Strong company growth signals in financial services sector\nNo prior purchasing history with this client\nSimilar company approved last quarter with prepay condition",
    "agent_model": "gpt-4"
  },
  "subject_company": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "external_id": "crm-acme-corp-001",
    "name": "Acme Corp",
    "domain": "https://acmecorp.com",
    "industry": "Financial Services",
    "country": "USA"
  },
  "decided_by_user": {
    "id": "d4e5f6a7-b8c9-0123-defg-234567890123",
    "name": "Sarah Chen",
    "title": "VP Sales"
  },
  "overrides": [
    {
      "user_id": "d4e5f6a7-b8c9-0123-defg-234567890123",
      "override_action": "MODIFIED",
      "override_reason": "Strategic logo win — accepting at reduced margin, multi-year potential",
      "created_at": "2026-02-12T10:40:00.000Z"
    }
  ],
  "links": []
}
```

**Request Body Fields:**

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

---

### 3. Get Decision (Audit View)

```
GET /api/v1/decisions/:id
```

Retrieves a decision with its full context trace, including:
- Original AI recommendation and rationale
- Context snapshot (signals at decision time)
- Human overrides with reasons
- Decision maker details (name, title)
- Linked precedent decisions
- Subject company details
- External source provenance

**Headers:**

```
X-API-Key: your-api-key
```

**Sample Request:**

```bash
curl http://localhost:3000/api/v1/decisions/f47ac10b-58cc-4372-a567-0e02b2c3d479 \
  -H "X-API-Key: your-api-key"
```

**Sample Response (200):**

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "client_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "subject_company_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "deal_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "context_key": "payment_onboarding",
  "decision_type": "DISCOUNT",
  "status": "OVERRIDDEN",
  "urgency": "NORMAL",
  "summary": "Acme Corp discount request",
  "recommended_action": "approve_with_conditions",
  "recommended_confidence": "MEDIUM",
  "suggested_conditions": [
    "Require upfront payment",
    "Limit discount to 10%"
  ],
  "final_action": "Approved 20% discount",
  "decided_by": "d4e5f6a7-b8c9-0123-defg-234567890123",
  "created_at": "2026-02-12T10:30:00.000Z",
  "decided_at": "2026-02-12T10:40:00.000Z",
  "recommendation": {
    "recommendation": "approve_with_conditions",
    "confidence": "medium",
    "rationale": [
      "Strong company growth signals in financial services sector",
      "No prior purchasing history with this client",
      "Similar company approved last quarter with prepay condition"
    ]
  },
  "context": {
    "signals": {
      "website_analysis": {
        "company_size": "500+ employees",
        "industry": "Financial Services",
        "growth_signal": "strong"
      },
      "reddit_mentions": 3,
      "trustpilot_rating": 4.2,
      "news_sentiment": "positive"
    },
    "policies": [
      {
        "name": "Standard Discount Policy",
        "rule": "Max 15% for new customers without purchase history"
      }
    ],
    "agent_rationale": "Strong company growth signals in financial services sector\nNo prior purchasing history with this client\nSimilar company approved last quarter with prepay condition",
    "agent_model": "gpt-4"
  },
  "subject_company": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "external_id": "crm-acme-corp-001",
    "name": "Acme Corp",
    "domain": "https://acmecorp.com",
    "industry": "Financial Services",
    "country": "USA"
  },
  "decided_by_user": {
    "id": "d4e5f6a7-b8c9-0123-defg-234567890123",
    "name": "Sarah Chen",
    "title": "VP Sales"
  },
  "overrides": [
    {
      "user_id": "d4e5f6a7-b8c9-0123-defg-234567890123",
      "override_action": "MODIFIED",
      "override_reason": "Strategic logo win — accepting at reduced margin, multi-year potential",
      "created_at": "2026-02-12T10:40:00.000Z"
    }
  ],
  "links": [
    {
      "id": "e5f6a7b8-c9d0-1234-efgh-345678901234",
      "relationship_type": "SIMILAR_CASE",
      "target_decision_id": "a0b1c2d3-e4f5-6789-abcd-ef0123456789",
      "confidence": 0.85
    }
  ]
}
```

**Error Responses:**

```json
// 404 — Decision not found
{
  "error": "Not Found",
  "message": "Decision not found"
}

// 401 — Missing or invalid API key
{
  "error": "Unauthorized",
  "message": "API key is required"
}
```

---

## Authentication

Currently uses API key authentication via:
- Header: `X-API-Key: your-key`
- Header: `Authorization: Bearer your-key`
- Query: `?apiKey=your-key` (testing only)

**Two tiers of API key:**

| Key Type | Resolved From | Behavior |
|---|---|---|
| Master key | `API_KEY` env var | Admin access; `client_id` must be in request body |
| Per-client key | `clients.api_key` column | Automatically scopes requests to the client |

Set `API_KEY` in your `.env` file. If omitted, authentication is skipped (development only).

---

## Database Schema

The schema implements a multi-client decision trace store with the following core tables:

| Table | Description |
|---|---|
| `clients` | ContextGrade's direct customers (B2B companies using the platform) |
| `users` | Humans within client orgs who make, review, or view decisions |
| `subject_companies` | Entities being evaluated (the client's leads/prospects) |
| `deals` | Revenue context anchoring decisions to deal value |
| `decision_contexts` | Client-defined context domains (e.g. payment_onboarding, hiring) |
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
   - Each client provides their own CRM identifier
   - All decisions for the same `external_id` are linked automatically
   - Unique per client: `(client_id, external_id)`

6. **Decision contexts are client-defined**
   - Contexts like `payment_onboarding`, `hiring`, `coding_practices` are scoped per client
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

| Script | Description |
|---|---|
| `npm run dev` | Start dev server (uses `.env`) |
| `npm run dev:sandbox` | Start dev server against sandbox DB |
| `npm run build` | Build TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to local/default DB |
| `npm run db:migrate` | Create migration against local/default DB |
| `npm run db:studio` | Open Prisma Studio for local/default DB |
| `npm run db:migrate:sandbox` | Create migration against sandbox DB |
| `npm run db:migrate:prod` | Deploy migrations to production DB |
| `npm run db:push:sandbox` | Push schema to sandbox DB |
| `npm run db:push:prod` | Push schema to production DB |
| `npm run db:studio:sandbox` | Open Prisma Studio for sandbox DB |
| `npm run db:studio:prod` | Open Prisma Studio for production DB |

### Code Style

- TypeScript strict mode enabled
- ESLint configuration recommended
- Prefer clarity over cleverness
- Comments explain WHY, not WHAT

## Troubleshooting

**Database connection errors:**
- Verify `DATABASE_URL` is correct
- Use the **direct connection** URL (not pooler) for migrations
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

**"Tenant or user not found" on migration:**
- You're using the Supabase **pooler** URL — switch to the **direct** connection URL
- Direct URL format: `postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres`

## License

MIT

---

**Built for decision intelligence — contextgrade.com**
