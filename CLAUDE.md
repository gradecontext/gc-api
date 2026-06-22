# CLAUDE.md

# ContextGrade Backend

## Product Vision

ContextGrade is a Decision Intelligence Platform.

Most software systems store what happened.

Examples:

* Salesforce stores deal state
* Jira stores ticket state
* Figma stores design state

However, organizations rarely store why decisions were made.

That reasoning is often lost in:

* Slack threads
* Meetings
* DMs
* Human memory

ContextGrade exists to capture, structure, and preserve decision context.

The long-term vision is to become a system of record for decisions and organizational memory.

---

# Core Product Philosophy

We are NOT building:

* CRM software
* Project management software
* Ticketing software
* Employee monitoring software
* Activity tracking software

We ARE building:

* Decision memory
* Decision lineage
* Decision traceability
* Organizational precedent
* Context graphs

Every feature should strengthen one of those goals.

---

# Product Thesis

Traditional systems answer:

"What happened?"

ContextGrade answers:

"Why did it happen?"

Examples:

* Why was a discount approved?
* Why was a ticket escalated?
* Why was a design changed?
* Why was an exception granted?
* Why was a customer rejected?

The answer becomes durable organizational memory.

---

# Domain Concepts

## Client

A paying customer of ContextGrade.

Examples:

* SaaS company
* Enterprise
* Startup

Clients own:

* Users
* Memberships
* Policies
* Decisions
* Contexts
* Events
* AI Decision Reports

---

## User

A human participant.

Users may:

* Create decisions
* Approve decisions
* Override recommendations
* Leave rationale
* Add notes

---

## Capture Surface

The mechanism through which events and decisions enter the system.

Current surfaces:

* **Chrome Extension** — user-triggered capture from any webpage
* **REST API** — direct B2B integration (webhooks, CRM sync)

Each surface produces either an ObservedEvent or a Decision directly.

---

## Chrome Extension

The Chrome extension is the primary human-facing capture surface.

It runs in the browser and allows users to:

* Record decisions while working inside any web tool (Figma, Jira, HubSpot, etc.)
* Attach rationale at the moment it exists — not retrospectively
* Log raw browser context before a formal decision is made

The extension identifies the subject via:

1. `external_id` — if provided (e.g. a CRM deal ID)
2. `domain` — stripped and used as a stable fallback (e.g. `figma.com`)
3. `name` — slugified as a last resort (e.g. `welcome-to-figjam`)

This fallback chain means `external_id` is optional for extension use.
B2B API integrations should always pass an explicit `external_id`.

### Extension Payload Example

The extension sends one request to `POST /decisions` with all fields:

```json
{
  "subject_company": {
    "name": "Welcome to FigJam",
    "domain": "figma.com"
  },
  "decision_type": "CUSTOM",
  "summary": "Change the base color to navy",
  "note": {
    "content": "Change the base color to navy.\n\nWhy: Because navy is the project theme color.\n\nContext: Agreed during design review.",
    "source_app": "figma",
    "source_url": "https://www.figma.com/file/..."
  }
}
```

Field mapping from the extension form:

| Extension field | API field |
|---|---|
| Source (e.g. Figma) | `note.source_app` |
| Source URL | `note.source_url` |
| Subject (page/entity name) | `subject_company.name` |
| Domain | `subject_company.domain` |
| Decision Type | `decision_type` |
| Decision (what was decided) | `summary` |
| Why | `note.content` |
| Additional context | appended to `note.content` |

**Important:** `subject_company` is the entity the decision is *about* (e.g. a Figma project, a deal, a ticket) — not the source application itself.

---

## Source Application

A registered source within a client account.

Examples:

* Chrome Extension
* HubSpot webhook
* Jira integration

Source applications allow signals to be traced back to their origin.

Each `ObservedEvent` records which source application produced it.

---

## Observed Event

Observed events are raw workflow events.

Examples:

* Jira ticket closed
* Figma comment resolved
* Salesforce discount changed
* HubSpot stage updated
* User opened a discount form in HubSpot (captured by extension)

Observed events are NOT decisions.

Observed events may later become decisions.

The `converted_to_decision_id` field tracks when an event was promoted to a decision.

---

## Decision

A decision is the atomic unit of truth.

A decision represents a meaningful judgment.

Examples:

* Approve 20% discount
* Reject onboarding
* Escalate support issue
* Accept payment terms exception

Decisions are saved immediately with no AI processing at log time.
AI analysis is triggered separately via the AI Reports system.

Decisions should be immutable once finalized.

---

## Client Decision Types

`DecisionType` is no longer a shared enum — it is a per-client table (`client_decision_types`).

Each client gets 8 reserved (system) types seeded automatically on account creation:

* `DISCOUNT`, `ONBOARDING`, `PAYMENT_TERMS`, `CREDIT_EXTENSION`, `PARTNERSHIP`, `RENEWAL`, `ESCALATION`, `CUSTOM`

Client admins can add unlimited custom types where `is_reserved = false`.
Reserved types cannot be modified or deleted.

---

## Decision Context

A category of reasoning.

Examples:

* Payment onboarding
* Pricing
* Security review
* Engineering
* Design

Contexts accumulate organizational knowledge.

---

## Client Context Categories

`ContextCategory` is no longer a shared enum — it is a per-client table (`client_context_categories`).

Each client gets 9 reserved (system) categories seeded automatically on account creation:

* `PAYMENT`, `ONBOARDING`, `HIRING`, `COMPLIANCE`, `ENGINEERING`, `SALES`, `PARTNERSHIP`, `SECURITY`, `CUSTOM`

Client admins can add unlimited custom categories where `is_reserved = false`.
Reserved categories cannot be modified or deleted.

A DB trigger (`trg_client_seed_default_types`) on `INSERT INTO clients` seeds both tables automatically for every new client.

---

## Decision Notes

Decision notes contain human reasoning.

Examples:

* "Customer experienced outage last month."
* "VP approved exception."
* "Design team agreed — red increases CTA visibility per A/B test."

Notes are intentionally unstructured.

They are often more valuable than structured fields.

Notes are append-only. They are never edited or deleted.

The `source_app` and `source_url` fields on a note record where it was written
(e.g. the Chrome extension URL at the time of capture).

---

## Decision Context Snapshot

Captures the state of the world when a decision was made.

No longer auto-created on every decision log — it is optional.
Future AI systems can write snapshots when performing retroactive analysis.

---

## Decision Links

Decision links create the Context Graph.

Examples:

* Similar Case
* Precedent
* Policy Exception
* Follow Up

The graph becomes institutional memory.

---

## AI Decision Reports

AI Decision Reports are compiled on-demand per client + context category.

The report:

1. Collects all decisions for a given client and context category
2. Compiles them into a `decision.md` Markdown document (decisions, notes, overrides, outcomes)
3. Optionally appends an AI Insights section if `OPENAI_API_KEY` is configured
4. Returns a structured report that can be fed directly into any AI tool as organisational context

Reports are triggered manually from the dashboard by client staff or admins.
They are **never** triggered automatically on decision creation.

Status flow: `GENERATING` → `COMPLETED` / `FAILED`

---

# Architectural Principles

## Event Sourcing Mindset

Preserve history.

Avoid destructive updates.

Prefer append-only records.

History is product value.

---

## Human Judgment First

Humans remain decision makers.

AI provides:

* context
* recommendations
* precedent

AI does not replace accountability.

---

## Explainability Over Automation

Every recommendation should be explainable.

Never create black-box logic.

The user must understand:

* why a recommendation exists
* what signals were used
* what precedent influenced it

---

## Auditability

Every decision should be traceable.

Future users should be able to answer:

"What happened?"

and

"Why?"

without searching Slack.

---

## Context Graph First

The graph is the moat.

The goal is not scoring.

The goal is capturing relationships between:

* decisions
* events
* policies
* entities
* outcomes

---

# API Overview

All routes are prefixed with `/api/v1`.

Authentication supports two strategies:

* `Authorization: Bearer <supabase-jwt>` — for user-facing surfaces (extension, app)
* `X-API-Key: <key>` — for B2B server integrations

When a JWT user belongs to multiple clients, pass `X-Client-Id: <id>` to select context.

## Current Endpoints

### Users
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/users/me` | Get authenticated user + memberships |
| POST | `/users` | Create user profile |

### Memberships
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/memberships/me` | Get user's memberships |

### Decisions
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/decisions` | List decisions for a client |
| POST | `/decisions` | Log a decision (no AI — raw capture only) |
| GET | `/decisions/:id` | Fetch a single decision with full context |
| POST | `/decisions/:id/review` | Human review — approve / reject / escalate |
| POST | `/decisions/:id/notes` | Append a reasoning note |
| GET | `/decisions/contexts` | List decision contexts for a client |

### Decision Types (per-client)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/decisions/types` | List all types (reserved + custom) |
| POST | `/decisions/types` | Create a custom decision type |
| PUT | `/decisions/types/:typeId` | Update a custom type (403 if reserved) |
| DELETE | `/decisions/types/:typeId` | Delete a custom type (403 if reserved) |

### Context Categories (per-client)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/decisions/context-categories` | List all categories (reserved + custom) |
| POST | `/decisions/context-categories` | Create a custom category |
| PUT | `/decisions/context-categories/:categoryId` | Update a custom category (403 if reserved) |
| DELETE | `/decisions/context-categories/:categoryId` | Delete a custom category (403 if reserved) |

### AI Decision Reports
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/ai-reports` | List reports for a client (`?category_id=&status=`) |
| POST | `/ai-reports/generate` | Trigger report generation for a category |
| GET | `/ai-reports/:id` | Fetch a report including full `content` markdown |

### Events
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/events` | Log a raw observed event (extension pre-decision capture) |

## Subject Company Identity

Every decision is anchored to a `SubjectCompany`.

Companies are upserted by `(client_id, external_id)`.

`external_id` is optional. When omitted, the backend derives a stable key:

1. Strip and use `domain` (e.g. `figma.com`)
2. Slugify `name` as a fallback (e.g. `welcome-to-figjam`)

B2B integrations should always pass an explicit `external_id` (e.g. CRM deal ID).
The extension may omit it and rely on `domain`.

---

# Long-Term Direction

The long-term vision is:

Decision Operating System for Organizations.

Capture surfaces (current and planned):

* Chrome Extension — in production
* REST API / Webhooks — in production
* Slack integration — planned
* Jira integration — planned
* GitHub integration — planned

Potential future entities:

* Jira Tickets
* GitHub PRs
* Figma Files
* Salesforce Opportunities
* Support Cases
* Documents

All become connected through decision traces.

---

# What We Avoid

Do not build:

* employee surveillance
* productivity scoring
* activity monitoring
* keystroke tracking

We only capture meaningful business decisions.

Examples:

* approved
* rejected
* escalated
* resolved
* published
* finalized

Signal quality matters more than event volume.

---

# Success Metric

Success is not:

"How many events did we collect?"

Success is:

"How much organizational reasoning did we preserve?"
