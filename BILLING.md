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

**The Stripe-billed quantity is always floored at the plan's seat minimum** (4 for GROWTH, 16 for SCALE) — `startCheckout`, `syncSeatCount`, and `previewPlanChange` all apply `Math.max(planMinimum, actualActiveSeats)` before talking to Stripe. Without this, a client could subscribe to SCALE and then shrink their team to dodge the $192/mo floor (2 seats × $12 = $24 instead of the guaranteed minimum). `ClientSubscription.seatCount` in the DB still reflects *actual* usage (e.g. "2 of 16 seats used" in `GET /billing`) — only the number sent to Stripe is floored.

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

**Stale `stripeCustomerId` self-healing.** A stored `ClientSubscription.stripeCustomerId` can go stale — the Stripe environment behind `STRIPE_SECRET_KEY` changed (switched sandboxes, reset test data), and the id simply no longer resolves. `billing.stripe.ts`'s `customerExists()` + `billing.service.ts`'s `getVerifiedStripeCustomerId()` check this before trusting a saved id: `startCheckout` transparently clears it and creates a fresh customer; `startBillingPortal`/`previewPlanChange` clear it and surface the existing "No billing account found for this client" 404 instead of a raw 500. Every call site that touches `stripeCustomerId` goes through this helper — don't read `subscription.stripeCustomerId` directly when adding new Stripe-facing code.

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

## Setup / troubleshooting

Only GROWTH and SCALE need real Stripe Products — create two Products ("Growth", "Scale"), each with a **monthly** and an **annual** recurring Price (4 prices total), and copy each Price's id into the matching `.env` var. Don't create anything for FREE or ENTERPRISE.

Common setup mistakes, both of which surface as a Stripe error on `POST /billing/checkout` rather than a config-time failure:

- **`No such price: 'prod_...'`** — a Product id was pasted into a `STRIPE_*_PRICE_ID` var instead of a Price id. Every Stripe object type has its own id prefix (`prod_` = Product, `price_` = Price) — a Product can have several Prices attached, each with its own `price_...` id. In the Dashboard, click into the specific price row under the product's Pricing section (not the product title) to get the right id.
- **`No such customer: 'cus_...'`** — a `ClientSubscription.stripeCustomerId` saved under one Stripe key/sandbox is being used against a different one (keys, webhook secret, and price ids must all come from the *same* sandbox/mode). Since this is self-healing (see above), retrying the request is usually enough; if not, clear the client's `stripeCustomerId`/`stripeSubscriptionId` manually.
- **Webhook signature failures** — the Stripe CLI (`stripe listen --forward-to <host>/api/v1/webhooks/stripe`) and any Dashboard-registered webhook endpoint are scoped to whichever sandbox/mode you're logged into; make sure `STRIPE_WEBHOOK_SECRET` came from the same one currently referenced by `STRIPE_SECRET_KEY`.

## What this deliberately does not do

- No admin UI for flagging a client ENTERPRISE — direct DB update, per the spec ("handled outside Stripe").
- No automatic seat-count-based plan changes — `resolvePlanForSeatCount` exists only to suggest a starting plan (e.g. at checkout), never to silently move a client between plans.
- No modification of past `Decision` records — billing is fully orthogonal to decision immutability.
