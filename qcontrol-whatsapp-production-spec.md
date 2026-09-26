# QControl Central WhatsApp Agent — Production Readiness & Concurrency Spec

Act as a senior backend/systems architect specializing in high-concurrency, multi-tenant SaaS platforms (Next.js + Supabase + Vercel), with deep WhatsApp Business Cloud API experience.

**Context:** QControl already has WhatsApp booking automation (Meta Cloud API + n8n) and a Supabase Realtime dashboard. This spec is NOT about building the WhatsApp agent from scratch — it's about hardening the existing/planned central WhatsApp booking flow so it is genuinely production-safe under real-world load: many businesses, many customers, many simultaneous conversations and bookings, all hitting the same shared infrastructure at once.

## Non-negotiable constraints
- Do not change unrelated parts of the codebase.
- Do not redesign features that already work.
- Reuse existing booking, session, customer, business, notification, and auth architecture. No parallel/duplicate booking or messaging systems.
- Strict multi-business data isolation, enforced server-side — never trust a client- or webhook-supplied `business_id`.
- Build and test locally first. Do NOT deploy, commit, or push.
- Never fake a success state (booking, message sent, delivered, etc.) — only report success after the real operation (DB write, WhatsApp API call) actually succeeds.

## 1. Concurrency & real-time correctness (primary focus)
This is the core problem to solve: multiple businesses and multiple customers can hit the system at the exact same moment.

- **Race-condition-proof booking**: a final server-side availability check + atomic, idempotent booking creation (e.g. DB-level unique constraint or `SELECT ... FOR UPDATE` / optimistic locking on the table/slot row) so two customers can never both win the same slot.
- **Per-business isolation under load**: one business's traffic spike (webhook flood, booking rush) must not degrade or block another business's conversations or bookings.
- **Webhook ingestion as a queue, not a request handler**: WhatsApp webhooks should be accepted fast (ack within Meta's timeout) and pushed into a queue/worker (n8n queue mode, Supabase Edge Function + pg queue, or a lightweight Redis/BullMQ layer) for processing, so a burst of incoming messages across many businesses doesn't block or drop events.
- **Idempotency everywhere**: dedupe by WhatsApp `message_id`/webhook delivery ID so retried or duplicate webhooks never create duplicate bookings or duplicate outbound messages.
- **Conversation state handling**: define how in-progress multi-step booking flows (select business → date → time → game → table → confirm) are stored per-customer-per-business (e.g. a `conversation_state` table keyed by phone+business, with TTL/expiry) so concurrent conversations across different customers/businesses never cross-contaminate state.
- **Supabase Realtime dashboard updates**: booking/session changes from WhatsApp must propagate to the correct business's dashboard channel only, in real time, without leaking cross-business events.

## 2. Load & failure handling
- Rate-limit handling per WhatsApp phone number and per business (respect Meta's throughput limits; queue/backoff rather than drop).
- Retry with backoff for transient WhatsApp API failures; circuit-break if the provider is down rather than retry-storming.
- If WhatsApp is temporarily unavailable, the booking must still be saved; notification/delivery happens asynchronously afterward — booking creation and message delivery must be decoupled.
- Structured logging with correlation IDs (webhook ID → conversation → booking) so a failure in a high-concurrency window can be traced.
- Message status tracking (queued → processing → sent → delivered → read → failed) with provider message IDs stored, never marking "sent" on a rejected send.

## 3. Business context resolution (must stay correct under load)
- Business identified via QR/click-to-chat deep link, business-specific link, or explicit selection when context is missing.
- Business resolution must be a server-side, validated lookup — never inferred from client input alone — even under concurrent requests from different businesses' customers.
- No internal IDs/UUIDs ever exposed to the customer-facing conversation.

## 4. Multi-business security under concurrent access
- Every DB query/operation resolves and validates business context server-side per request — no shared mutable state between requests that could leak across businesses under concurrency.
- No cross-business access to bookings, customers, tables, sessions, revenue, QKhata, reports, or settings, verified specifically under simultaneous multi-tenant load (not just single-tenant tests).

## 5. Dashboard & owner notifications
- Bookings from WhatsApp appear in the existing dashboard with source = WhatsApp, alongside Booking ID, business, customer, phone, date/time, game, table/resource, status, confirmation status.
- Owner notification fires immediately and only to the correct business, even when multiple businesses receive bookings in the same instant.

## 6. Concurrency test matrix (must pass before considering this production-ready)
- Two customers booking the same table at the same time (only one succeeds).
- Duplicate webhook delivery for the same message.
- Customer double-tapping "Confirm."
- Multiple businesses receiving bookings in the same second — verify no cross-talk in state, dashboard, or notifications.
- High-volume simultaneous "Hi" messages from many customers across many businesses.
- Table becoming unavailable mid-confirmation.
- WhatsApp API timeout/failure during send.
- DB failure mid-transaction (booking must not half-commit).
- Server restart mid-booking-flow (in-progress conversation state must not corrupt or duplicate).
- Sustained load test: N businesses × M concurrent customer conversations — confirm no dropped webhooks, no data bleed, no duplicate bookings.

## 7. Compliance check (before finalizing production messaging behavior)
Verify current Meta/WhatsApp Business Platform requirements for: customer-initiated vs business-initiated conversations, template messages, messaging windows, opt-in/consent, rate limits, webhook signature verification. Design around actual documented behavior — do not assume.

## 8. QA before sign-off
End-to-end local test across concurrent, multi-business scenarios: webhook → business resolution → real-time availability → atomic booking → DB → dashboard (correct business only) → owner notification (correct business only) → customer confirmation → reminder → cancel/reschedule. No mocked success states anywhere in this path.

## Deliverable
A hardened, load-tested version of the existing WhatsApp booking flow that can safely run one shared QControl number across many businesses and many simultaneous customers — with the concurrency, isolation, and failure-handling guarantees above — without touching unrelated features, and without deploying/committing/pushing.
