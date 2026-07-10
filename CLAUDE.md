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
* A Subscription (billing — see below)

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

Admins control where the extension activates. The extension is not shown on
every webapp — only on domains an admin has explicitly registered as a
**Subject Company / Source** (see below). On page load, the extension:

1. Fetches the client's source list via `GET /decisions/subject-companies`
2. Matches the current tab's domain against the active entries
3. If matched, shows its capture icon; if not, stays hidden

Clicking the icon opens the capture window, pre-filled with the matched
source's `external_id` — the user never types a subject/domain by hand.

### Extension Payload Example

The extension sends one request to `POST /decisions`, referencing the matched
source by `external_id` instead of describing a subject company inline:

```json
{
  "external_id": "figma.com",
  "decision_type": "CUSTOM",
  "context_category": "ENGINEERING",
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
| Matched source (from `/decisions/subject-companies`) | `external_id` |
| Source (e.g. Figma) | `note.source_app` |
| Source URL | `note.source_url` |
| Decision Type (dropdown, from `/decisions/types`) | `decision_type` |
| Context Category (dropdown, from `/decisions/context-categories`) | `context_category` |
| Decision (what was decided) | `summary` |
| Why | `note.content` |
| Additional context | appended to `note.content` |

`decision_type` and `context_category` are both required, independent classifications —
resolved by value against the client's `client_decision_types` / `client_context_categories`
tables. Picking one does not constrain or default the other (e.g. a `DISCOUNT` decision can
land under `SALES`, `PAYMENT`, or any other category).

**Important:** decision logging is lookup-only — it never creates a subject
company. `external_id` must reference an existing, active row registered via
`/decisions/subject-companies`; otherwise `POST /decisions` returns 400.

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

## Client Context Categories

`ContextCategory` is no longer a shared enum — it is a per-client table (`client_context_categories`).

Each client gets 9 reserved (system) categories seeded automatically on account creation:

* `PAYMENT`, `ONBOARDING`, `HIRING`, `COMPLIANCE`, `ENGINEERING`, `SALES`, `PARTNERSHIP`, `SECURITY`, `CUSTOM`

Client admins can add unlimited custom categories where `is_reserved = false`.
Reserved categories cannot be modified or deleted.

A DB trigger (`trg_client_seed_default_types`) on `INSERT INTO clients` seeds both tables automatically for every new client.

Every decision references a context category directly (`decisions.context_category_id`,
required, FK to `client_context_categories`) — this is what AI Decision Reports group by.
There used to be an intermediate `DecisionContext` "topic" table (e.g. a named topic like
`payment_onboarding` sitting under the `PAYMENT` category), but it had no admin-facing way
to create topics and made `context` optional on a decision, which meant decisions logged
without one were silently excluded from every report. That layer was removed — `decision_type`
and `context_category` are now two independent, required, flat classifications on every
decision, resolved the same way (human-readable value → per-client FK lookup), with no
decision ever missing a category.

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

## MCP Server (Report Consumption Surface)

Where the Chrome Extension and REST API are **capture** surfaces (decisions
flowing in), the MCP server is the one **consumption** surface (compiled
context flowing out) — it lets an LLM client (Claude Code, Claude Desktop,
Cursor, ChatGPT, etc.) pull a client's AI Decision Reports directly instead
of a human copy-pasting `decision.md` into a prompt.

Mounted at `/mcp` (Streamable HTTP transport, stateless — a fresh MCP
server + transport is built per request), **not** under `/api/v1` — MCP
clients configure one bare server URL, not a REST-prefixed path.

Read-only, by design: three tools, all backed by the same client-scoped
service functions the REST API already uses (`getContextCategories`,
`getReports`, `getReport`) —

* `list_context_categories` — this client's context categories
* `list_ai_reports` — report metadata, filterable by `category_id`/`status`
* `get_ai_report` — one report's full markdown `content` by id

No tool can trigger report generation or touch raw decisions. Report
generation stays dashboard/API-triggered only (see AI Decision Reports
above) — there is no cron job yet.

### Authentication — `mcpApiKey`, a credential separate from `apiKey`

Every client gets a second, independent secret generated at creation
alongside the existing `apiKey`: `mcpApiKey` (`Client.mcpApiKey`, prefixed
`mcp_` for at-a-glance identifiability). The two credentials are
**deliberately non-interchangeable**, enforced by using entirely separate
auth middleware:

* `authenticate` (general REST API, `/api/v1/*`) resolves `apiKey` only —
  an `mcpApiKey` is rejected here (401).
* `authenticateMcp` (`/mcp` only) resolves `mcpApiKey` only — the general
  `apiKey`, and even the master `API_KEY`, are rejected here (401/400). MCP
  access is inherently single-tenant; there's no sensible "which client's
  reports" answer for a non-client-scoped key.

This means leaking an LLM client's local MCP config can't be used against
the REST API, and revoking MCP access never requires rotating the key every
other integration (webhooks, CRM sync) depends on.

`GET /clients/mcp-key` (ADMIN role, `authenticate`) exposes the key for
display in the dashboard's "MCP Integration" settings panel — read-only,
copy-to-clipboard. There is no rotate/regenerate endpoint yet.

---

## Client Subscription (Billing)

Every client has exactly one `ClientSubscription` — seeded `FREE` / `ACTIVE`
automatically on account creation via a DB trigger (`trg_client_seed_subscription`,
same pattern as the decision-type/context-category seed trigger).

Plans:

* `FREE` — up to 3 active members, no Stripe subscription
* `GROWTH` — 4–15 active members, $15/seat/month ($150/seat/year)
* `SCALE` — 16–50 active members, $12/seat/month ($120/seat/year)
* `ENTERPRISE` — 50+ members, custom pricing, handled outside Stripe (manual flag, no self-serve checkout)

Seats are billed against **active memberships only** — pending/rejected
memberships never count, and Growth/Scale each have a seat-count minimum
charge (4 and 16 seats respectively) so a client can't under-report seats to
pay less than their plan's floor.

Hitting a plan's seat or feature limit blocks the action with a 402 and an
upgrade hint (`SeatLimitExceeded` / `FeatureLimitExceeded`) — ContextGrade
never auto-upgrades or auto-downgrades a client. Every plan change is an
explicit action: a checkout, a cancellation, or a Stripe webhook telling us
something changed.

`Client.plan` is a denormalized mirror of `ClientSubscription.plan`, kept in
sync only by the billing service, so legacy consumers (`/users/me`,
membership responses) don't need a join. Nothing else should ever write
`Client.plan` directly.

See `BILLING.md` for full detail: feature flags, enforcement points, Stripe
webhook handling, and setup troubleshooting.

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

The MCP server (`/mcp`, not under `/api/v1`) uses a third, separate scheme —
`X-API-Key: <mcpApiKey>` — that is **not** interchangeable with the
`X-API-Key: <apiKey>` used above. See "MCP Server" under Domain Concepts.

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
| POST | `/decisions` | Log a decision (no AI — raw capture only; `external_id` must reference an existing subject company; `decision_type` and `context_category` are both required) |
| GET | `/decisions/:id` | Fetch a single decision with full context |
| POST | `/decisions/:id/review` | Human review — approve / reject / escalate |
| POST | `/decisions/:id/notes` | Append a reasoning note |

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

### Clients (admin)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/clients/mcp-key` | Fetch this client's `mcpApiKey` for display in dashboard settings (ADMIN role only) |

### Events
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/events` | Log a raw observed event (extension pre-decision capture) |

### Subject Companies / Sources (per-client)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/decisions/subject-companies` | List all subject companies (sources) for a client |
| POST | `/decisions/subject-companies` | Register a new source (admin only) |
| PUT | `/decisions/subject-companies/:subjectCompanyId` | Update a source (admin only) |
| DELETE | `/decisions/subject-companies/:subjectCompanyId` | Deactivate a source (admin only — soft delete) |

### Billing (per-client, ADMIN role only)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/billing` | Current subscription, seat count/limit, feature flags |
| GET | `/billing/plans` | Full plan catalog with pricing + feature flags |
| POST | `/billing/checkout` | Create a Stripe Checkout session for GROWTH/SCALE |
| GET | `/billing/portal` | Create a Stripe Billing Portal session |
| GET | `/billing/preview` | Preview prorated cost of a plan/seat change |
| POST | `/billing/cancel` | Schedule cancellation at period end |
| POST | `/billing/reactivate` | Undo a scheduled cancellation |

### Webhooks
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/webhooks/stripe` | Stripe event ingestion — signature-verified, no `authenticate` middleware (Stripe itself is the caller) |

### MCP Server (not under `/api/v1`)
| Method | Path | Purpose |
|--------|------|---------|
| ALL | `/mcp` | Streamable HTTP MCP endpoint — read-only tools over compiled AI Decision Reports; `authenticateMcp` (`mcpApiKey` only). See "MCP Server" under Domain Concepts. |

## Subject Company Identity

Every decision is anchored to a `SubjectCompany` — the entity the decision is
*about* (e.g. a Figma project, a deal, a ticket), identified by a website
domain in the common case (e.g. `figma.com`, `salesforce.com`, `bamboohr.com`).

Subject companies are **admin-curated**, not auto-created. An admin registers
each one via `POST /decisions/subject-companies` (`name` + `domain`, with
`external_id` defaulting to the stripped domain if omitted). This same list
is what the Chrome extension fetches to decide where it should show its icon.

`POST /decisions` only ever performs a lookup by `(client_id, external_id)`
against active subject companies — it never creates or upserts one. If
`external_id` doesn't match an active row, the request fails with 400.

Deleting a source (`DELETE /decisions/subject-companies/:id`) deactivates it
(`active = false`) rather than removing the row — existing decisions keep
their historical link, and the extension stops matching that domain going
forward. Reactivate by `PUT`-ing `active: true`.

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
