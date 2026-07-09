# Billing

Seat-based subscription billing on top of Stripe. Source: `src/modules/billing/`.

## Plans

| Plan | Seats | Price/seat/mo | Price/seat/yr (2 mo free) | Minimum charge |
|---|---|---|---|---|
| FREE | 0–3 | $0 | $0 | $0 |
| GROWTH | 4–15 | $15 | $150 | $60/mo (4 seats) |
| SCALE | 16–50 | $12 | $120 | $192/mo (16 seats) |
| ENTERPRISE | 51+ | Custom | Custom | Custom |

FREE and ENTERPRISE never go through Stripe:
- FREE is the default for every new client (seeded automatically, see below).
- ENTERPRISE is a manual flag — set `ClientSubscription.plan = ENTERPRISE` directly (Prisma Studio / SQL) once a contract is signed. There is no self-serve path to it.

Seat ranges are enforced against **active memberships only** (`Membership.status = ACTIVE`). Pending/rejected memberships never count.

## `Client.plan` vs `ClientSubscription.plan` — read this before touching either

There are two `plan` fields and they mean different things:

- **`ClientSubscription.plan`** (this module) is the real source of truth for billing — what the client is actually paying for, synced from Stripe via webhooks.
- **`Client.plan`** is a **denormalized mirror** of the above, kept in sync only by `billing.service.ts` (`syncClientPlanMirror`). It exists purely so pre-existing consumers (`/users/me`, membership list responses) keep working without needing a join. **Never write `Client.plan` directly anywhere else** — if you need the authoritative plan, read `ClientSubscription`.

This split exists because `Client.plan` predates billing (it used to be a `STARTER`/`PROFESSIONAL` self-reported field set at signup) and `Lead.planInterest` / `BetaAccessList.planInterest` still use the same `PlanTier` enum for the same original purpose: a pre-signup "which plan are you interested in" signal, unrelated to any live subscription. Client creation (`clients.service.ts`) always defaults to `FREE` now — a `PlanTier` can no longer be requested at signup.

## Feature flags

Defined in `billing.types.ts` (`PLAN_CONFIG`). A feature is either `true`/`false` (on/off) or a number (a count limit, e.g. "3 AI reports/month on FREE").

| Feature | FREE | GROWTH | SCALE | ENTERPRISE |
|---|---|---|---|---|
| `AI_REPORTS` | 3/month | unlimited | unlimited | unlimited |
| `DECISION_EXPORT` | ✗ | ✓ | ✓ | ✓ |
| `API_ACCESS` | ✗ | ✓ | ✓ | ✓ |
| `CUSTOM_TYPES` | 5 | unlimited | unlimited | unlimited |
| `AUDIT_LOG` | ✗ | ✗ | ✓ | ✓ |
| `SSO` | ✗ | ✗ | ✗ | ✓ |

`hasFeatureAccess(plan, feature)` returns the raw value above. `assertCustomTypeAllowed` / `assertAiReportAllowed` wrap it with the actual usage count and throw `FeatureLimitExceededError` when exceeded.

## Enforcement points

| Action | Check | On failure |
|---|---|---|
| `PATCH /memberships/:id/approve` | `checkSeatLimit(clientId, 1)` before approving | 402 `SeatLimitExceeded` |
| `POST /decisions/types` | `assertCustomTypeAllowed` (FREE only) | 402 `FeatureLimitExceeded` |
| `POST /ai-reports/generate` | `assertAiReportAllowed` (FREE only) | 402 `FeatureLimitExceeded` |

`syncSeatCount(clientId)` recomputes `ClientSubscription.seatCount` from active memberships and is called after `approveMembership` and after `removeMembership` (when the removed membership was ACTIVE). It also nudges the Stripe subscription's `quantity` to match, if one exists — that's a billing-accuracy update, not a plan change, so it's exempt from the "no auto-upgrade" rule below.

**No automatic plan upgrades or downgrades.** Every plan change is an explicit action: a user hits checkout, cancels, or Stripe tells us something changed via webhook. Hitting a seat/feature limit blocks the action with a 402 and an `upgradeRequired` hint — it never silently upgrades anyone.

## Seeding

Every new client gets a `FREE`/`ACTIVE` `ClientSubscription` row automatically via the `trg_client_seed_subscription` DB trigger (mirrors the existing `trg_client_seed_default_types` pattern for decision types/context categories). `billing.repository.ensureSubscription()` is a defensive fallback for any client created before the migration in `prisma/migrations/20260708120000_add_billing_subscriptions/` is applied.

## Stripe integration

- `billing.stripe.ts` — thin SDK wrapper (customers, checkout sessions, billing portal, subscription quantity updates, invoice previews, webhook signature verification). No business logic.
- `billing.service.ts` — orchestrates `billing.stripe.ts` + `billing.repository.ts`. This is what controllers and other modules call.
- `billing.webhook.ts` — `POST /api/v1/webhooks/stripe`. Reads the raw body via `c.req.text()` (this app has no global JSON body-parsing middleware, so no special exclusion was needed) and verifies `stripe-signature` before trusting the payload. Handles:
  - `checkout.session.completed` → activates the subscription (reads `plan`/`billingCycle`/`clientId` back from Checkout Session metadata, set when the session was created)
  - `invoice.payment_succeeded` → refreshes the current billing period, sets status `ACTIVE`
  - `invoice.payment_failed` → sets status `PAST_DUE`
  - `customer.subscription.updated` → resyncs plan (via reverse price-id lookup), seat quantity, billing cycle, cancellation flag
  - `customer.subscription.deleted` → sets status `CANCELED`, downgrades to `FREE`

Required env vars (`.env.example`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_GROWTH_MONTHLY_PRICE_ID`, `STRIPE_GROWTH_ANNUAL_PRICE_ID`, `STRIPE_SCALE_MONTHLY_PRICE_ID`, `STRIPE_SCALE_ANNUAL_PRICE_ID`. All optional at boot — billing routes/webhook return a `503 Not Configured` error at call time if unset, rather than failing app startup.

## API

All under `/api/v1/billing`, behind `authenticate` + `requireRole("ADMIN")` (this codebase's membership model only has `ADMIN`/`STAFF` — no `OWNER` — so `ADMIN` is the gate):

| Method | Path | Purpose |
|---|---|---|
| GET | `/billing` | Current subscription, seat count/limit, feature flags |
| GET | `/billing/plans` | Full plan catalog with pricing + feature flags |
| POST | `/billing/checkout` | Create a Stripe Checkout session (`{ plan, billing_cycle, success_url, cancel_url }` → `{ url }`) |
| GET | `/billing/portal?return_url=` | Create a Stripe Billing Portal session → `{ url }` |
| GET | `/billing/preview?plan=&seat_count=` | Preview the prorated cost of a plan/seat change |
| POST | `/billing/cancel` | Schedule cancellation at period end |
| POST | `/billing/reactivate` | Undo a scheduled cancellation |

## What this deliberately does not do

- No admin UI for flagging a client ENTERPRISE — direct DB update, per the spec ("handled outside Stripe").
- No automatic seat-count-based plan changes — `resolvePlanForSeatCount` exists only to suggest a starting plan (e.g. at checkout), never to silently move a client between plans.
- No modification of past `Decision` records — billing is fully orthogonal to decision immutability.
