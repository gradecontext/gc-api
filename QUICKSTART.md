# ContextGrade Quick Start Guide

## ✅ What's Been Built

You now have a fully functional decision-intelligence microservice with:

### Core Components

1. **Database Schema** (`prisma/schema.prisma`)
   - All core tables: organizations, users, companies, deals, decisions
   - Decision trace store: context snapshots, overrides, outcomes, links
   - Ready for Supabase Postgres

2. **API Endpoints** (3 endpoints)
   - `POST /api/v1/decisions` - Create decision (webhook entry point)
   - `POST /api/v1/decisions/:id/review` - Human review
   - `GET /api/v1/decisions/:id` - Fetch decision with full context

3. **Context Gathering**
   - Website signal collection (V1 working)
   - Placeholders for Reddit, Twitter, G2, Trustpilot (V2 ready)

4. **AI Decision Agent**
   - OpenAI integration (gpt-4o-mini)
   - Structured JSON output
   - Fallback to manual review if AI unavailable

5. **Infrastructure**
   - Fastify server with error handling
   - API key authentication (dev-friendly)
   - Structured logging
   - TypeScript strict mode

## 🚀 Getting Started (5 minutes)

### Step 1: Set up Database

1. Create a Supabase project or use existing PostgreSQL
2. Copy `.env.example` to `.env`
3. Update `DATABASE_URL` in `.env`:

```bash
DATABASE_URL=postgresql://user:password@host:5432/contextgrade?sslmode=require
```

### Step 2: Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

### Step 3: Configure AI (Optional for Testing)

Add to `.env`:
```bash
OPENAI_API_KEY=sk-your-key-here
```

If omitted, the service will use fallback recommendations.

### Step 4: Start Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

Server starts on `http://localhost:3000`

## 🧪 Test the Service

### 1. Health Check

```bash
curl http://localhost:3000/health
```

### 2. Create a Decision (Webhook Simulation)

```bash
curl -X POST http://localhost:3000/api/v1/decisions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "organization_id": "00000000-0000-0000-0000-000000000001",
    "company": {
      "name": "Acme Corp",
      "domain": "https://acme.com",
      "industry": "Technology",
      "country": "USA"
    },
    "deal": {
      "amount": 50000,
      "currency": "USD",
      "discount_requested": 15
    },
    "decision_type": "DISCOUNT"
  }'
```

This will:
1. Create/find the company
2. Gather context (website signals)
3. Generate AI recommendation
4. Return decision with recommendation

### 3. Review the Decision

```bash
# Get decision ID from previous response, then:
curl -X POST http://localhost:3000/api/v1/decisions/{DECISION_ID}/review \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "action": "approve",
    "note": "Strategic logo win"
  }'
```

### 4. Fetch Decision (Audit View)

```bash
curl http://localhost:3000/api/v1/decisions/{DECISION_ID} \
  -H "X-API-Key: your-api-key"
```

## 📊 Database Inspection

Use Prisma Studio to inspect data:

```bash
npm run db:studio
```

Opens at `http://localhost:5555`

## 🔍 What Happens Internally

When you create a decision:

1. **Company Lookup/Creation**
   - Finds existing company by domain or creates new

2. **Context Gathering**
   - Fetches website (if domain provided)
   - Extracts meta description/content
   - Placeholder stubs for Reddit, Twitter, etc.

3. **AI Recommendation**
   - Sends context to OpenAI
   - Receives structured JSON recommendation
   - Falls back to "review_manually" if AI unavailable

4. **Decision Persistence**
   - Creates decision record with status "PROPOSED"
   - Stores context snapshot (JSONB)
   - Stores recommendation and rationale

5. **Response**
   - Returns full decision object with recommendation

## 🎯 Next Steps

1. **Set up Supabase Database** (if not done)
2. **Test with real company domains**
3. **Configure API keys** (OpenAI recommended)
4. **Build webhook integration** with your CRM
5. **Implement V2 features**:
   - Reddit API integration
   - Twitter/X API
   - G2/Trustpilot
   - Precedent search

## 🐛 Troubleshooting

**"Database connection failed"**
- Check `DATABASE_URL` format
- Ensure database exists
- Verify SSL settings for Supabase

**"API key is required"**
- Set `API_KEY` in `.env`, or
- Omit it for development (auth skipped)

**"AI recommendation failed"**
- Check `OPENAI_API_KEY` is valid
- Service falls back to manual review automatically
- Check logs for detailed errors

**TypeScript errors**
- Run `npm install` to ensure dependencies installed
- Run `npm run db:generate` to generate Prisma client

## 📝 Architecture Notes

- **Decisions are immutable** - can update status, cannot delete
- **Context is snapshot-based** - captured at decision time
- **AI is advisory** - humans make final decisions
- **No numeric scores** - recommendations + rationale only

---

**Ready to integrate!** 🚀
