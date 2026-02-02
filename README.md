# ContextGrade

**Decision intelligence for onboarding, pricing, and trust.**

A B2B SaaS microservice that provides real-time decision intelligence by analyzing company context and generating AI-powered recommendations for onboarding, discount approvals, and payment terms.

## 🎯 Product Positioning

ContextGrade is positioned as:
- **Decision intelligence for onboarding, pricing, and trust**
- **System of record for decisions** (not analytics)
- **In the execution path** (not background analysis)

## 🏗️ Architecture

```
CRM / Billing System
   │ (webhook)
   ▼
Decision Trigger Service ← You are here
   │
   ▼
Context Gatherer Agent
   │
   ▼
Decision Proposal Agent
   │
   ▼
Human Review UI (Future)
   │
   ▼
Decision Trace Store (Context Graph)
   │
   ├── Writeback to CRM
   └── Precedent Search
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+, TypeScript
- **Framework**: Fastify
- **Database**: Supabase Postgres (via Prisma ORM)
- **AI**: OpenAI (Anthropic supported)
- **Auth**: API Key-based (simple middleware)

## 📁 Project Structure

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

## 🚀 Getting Started

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

## 📡 API Endpoints

### 1. Create Decision (Webhook Entry Point)

**POST** `/api/v1/decisions`

Creates a new decision, gathers context, and generates an AI recommendation.

**Request Body:**
```json
{
  "organization_id": "uuid",
  "company": {
    "name": "Acme Corp",
    "domain": "https://acme.com",
    "industry": "Technology",
    "country": "USA"
  },
  "deal": {
    "crm_deal_id": "sf-12345",
    "amount": 50000,
    "currency": "USD",
    "discount_requested": 15
  },
  "decision_type": "DISCOUNT"
}
```

**Response:**
```json
{
  "id": "decision-uuid",
  "organization_id": "uuid",
  "company_id": "uuid",
  "decision_type": "DISCOUNT",
  "status": "PROPOSED",
  "recommended_action": "approve_with_conditions",
  "recommended_confidence": "MEDIUM",
  "recommendation": {
    "recommendation": "approve_with_conditions",
    "confidence": "medium",
    "rationale": [
      "Multiple recent complaints about delayed payments",
      "No prior purchasing history"
    ],
    "suggested_conditions": [
      "Require upfront payment",
      "Limit discount to 10%"
    ]
  },
  "context": {
    "signals": { ... },
    "agent_rationale": "..."
  },
  "created_at": "2026-01-01T00:00:00Z"
}
```

### 2. Review Decision (Human Action)

**POST** `/api/v1/decisions/:id/review`

Allows a human to approve, reject, or override a decision.

**Request Body:**
```json
{
  "action": "approve",
  "note": "Strategic logo win"
}
```

**Actions:**
- `approve`: Approve the recommendation
- `reject`: Reject the recommendation
- `override`: Override with custom action

### 3. Fetch Decision (Audit View)

**GET** `/api/v1/decisions/:id`

Retrieves a decision with full context, including:
- Original recommendation
- Context snapshot
- Human overrides
- Linked precedents

### Health Check

**GET** `/health`

Returns service health status.

## 🔐 Authentication

Currently uses API key authentication via:
- Header: `X-API-Key: your-key`
- Header: `Authorization: Bearer your-key`
- Query: `?apiKey=your-key`

Set `API_KEY` in your `.env` file. If omitted, authentication is skipped (development only).

## 🗄️ Database Schema

The schema implements a decision trace store with the following core tables:

- **organizations**: Your customers (B2B SaaS using ContextGrade)
- **users**: Humans making decisions
- **companies**: Subject of decisions (your customer's customer)
- **deals**: Revenue context for decisions
- **decisions**: Immutable decision events
- **decision_context_snapshots**: Time-travel context snapshots
- **decision_human_overrides**: Human judgment capture
- **decision_links**: Precedent relationships (context graph foundation)

See `prisma/schema.prisma` for complete schema definition.

## 🧠 Core Domain Rules

1. **Decisions are immutable events**
   - You may update status
   - You may append overrides
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

## 🔮 Roadmap (V2+)

- [ ] Reddit API integration
- [ ] Twitter/X API integration
- [ ] G2 and Trustpilot integration
- [ ] Financial health APIs
- [ ] Precedent search by similarity
- [ ] Decision outcome tracking
- [ ] Human Review UI
- [ ] Webhook writeback to CRM
- [ ] Graph database promotion (AGE extension)
- [ ] OAuth/JWT authentication
- [ ] Multi-tenant isolation

## 📝 Development

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

## 🐛 Troubleshooting

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

## 📄 License

MIT

---

**Built with ❤️ for decision intelligence**
