# Qcontrol — Landing Page Redesign Brief
**Target tool:** Antigravity (agentic build)
**Project:** Qcontrol — QR-based session billing & club management platform (pool, snooker, billiards, PS5, gaming lounges)
**Stack:** Next.js (App Router), Supabase, Vercel, Tailwind CSS

---

## 1. Context

Qcontrol is a live, production SaaS product. This is a **redesign of the marketing landing page only** — a new visual and structural layer, not a product rewrite.

**Hard constraints (do not violate):**
- Do NOT touch, refactor, or modify any product/application logic, routes, Supabase schema, or backend behavior. Landing page (`/`) only.
- Do NOT invent features, integrations, or capabilities that don't exist in the actual product. Every claim on this page must map to something genuinely built.
- Do NOT hardcode final pricing numbers if pricing isn't finalized — build the pricing section as a configurable data structure (array/JSON/CMS-ready) instead.
- Do NOT introduce unsupported quantitative claims ("reduce work by 40%", "10,000+ businesses", etc.) unless explicitly provided.
- Preserve Qcontrol's existing brand identity — name, terminology (QKhata, Qpulse, etc.), tone, and visual language. This must not read as a generic templated SaaS page.
- No emojis anywhere in copy or UI.

If any required product detail (exact feature list, plan pricing, testimonials, logos) is missing or ambiguous, insert a clearly marked placeholder (e.g. `{{PRICE_STARTER_MONTHLY}}`) rather than fabricating a value.

---

## 2. Objective

Convert billiards/gaming business owners (non-technical, ROI-driven, time-poor) into signups within the first 60–90 seconds on the page.

The page must let a visiting owner understand, in order:
1. What Qcontrol is
2. What problems it solves
3. What it can actually do
4. How it helps their specific business
5. What it costs
6. Why they can trust it
7. How to get started

---

## 3. Information Architecture (build in this exact order)

1. **Hero** — headline: "Run your gaming business smarter with Qcontrol." Sub-copy covering sessions, tables, bookings, members, QKhata, payments, reports, integrations, and business insights as one unified system. Primary CTA "Get Started", secondary CTA "Explore Qcontrol". Prominent dashboard/product visual (real screenshot or high-fidelity mockup, not stock imagery).
2. **Why Qcontrol** — problem/solution pairing: manual session tracking, booking confusion, payment tracking, QKhata management, fragmented communication channels, lack of business insight. Each problem paired with the specific Qcontrol capability that resolves it.
3. **Product Overview** — visual module grid: Dashboard, Live Sessions, QR Sessions, Bookings, Members, QKhata, Payments, Reports, Food & Beverages, Telegram, WhatsApp/SMS, Qpulse, AI Business Assistant. One benefit-first sentence per module — no feature-dump lists.
4. **How It Works** — 4-step flow: Set up business → Start managing sessions → Automate operations → Grow with insights. Visual stepper, not a text list.
5. **Real-Time Management** — communicate instant sync across QR actions, dashboard, and integrations. Use a live-feeling visual (animated state change, mock live feed) rather than prose alone.
6. **AI Business Assistant** — explicitly an **owner-facing** analytics/insight tool (business performance, revenue insights, busy/slow period detection, table utilization, growth recommendations, natural-language business Q&A). Must be visually and copy-wise distinguished from a customer-support chatbot — do not let this read as a chat widget.
7. **Food & Beverage** — owner creates a menu; customers access it via the QR flow. Show the customer-facing QR menu experience as a secondary visual.
8. **Integrations** — Telegram, WhatsApp, SMS, and "more coming" — kept lightweight, logos/icons over paragraphs.
9. **Pricing** — clean tiered cards, monthly/yearly toggle (if supported by the product), one clearly highlighted/recommended plan, feature checklist per tier, no invented prices (see placeholder rule above).
10. **Business Use Cases** — billiards clubs, pool/snooker clubs, gaming lounges, PS5/gaming businesses, multi-table entertainment venues. Short, segment-specific value statements.
11. **ROI / Business Value** — qualitative, defensible outcomes only: less manual work, faster table turnover management, tighter payment tracking, fewer booking errors, better member management, clearer visibility into business performance. No fabricated percentages or figures.
12. **Security & Reliability** — business data isolation (multi-tenant), authentication, cloud architecture (Supabase/Vercel), data persistence, realtime sync, backups — state only what is actually implemented.
13. **FAQ** — cover: What is Qcontrol / Who is it for / How does QR session management work / Multi-table support / How QKhata works / Booking management / Telegram-WhatsApp-SMS connectivity / Mobile support / How pricing works / How to get started.
14. **Final CTA** — headline: "Your tables are running. Your business should be too." CTA: "Get Started with Qcontrol."

---

## 4. Design System

- Premium, modern SaaS aesthetic — restrained, confident, not flashy.
- Strong typographic hierarchy; type does most of the heavy lifting, not decoration.
- Subtle motion only (scroll-reveal, micro-interactions, state transitions) — no gratuitous animation.
- Product screenshots/mockups are the visual anchor of the page — treat them as first-class content, not filler.
- Full responsiveness: mobile, tablet, desktop — mobile-first build.
- Light and dark mode, consistent with Qcontrol's existing theme tokens (reuse existing design tokens/Tailwind config if present in the repo — do not introduce a new color system).
- Generous, intentional whitespace. Avoid clutter, avoid gradient-heavy or "AI startup template" visual clichés.
- Clear, single-priority CTA hierarchy per section — never compete two CTAs of equal visual weight.

---

## 5. Technical Requirements

- Framework: Next.js App Router, Server Components by default; use Client Components only where interactivity requires it (pricing toggle, scroll animations, AI assistant demo interaction).
- Performance: target Lighthouse 90+ on Performance/Accessibility/SEO/Best Practices. Lazy-load below-the-fold imagery, use `next/image` for all visuals, avoid layout shift.
- SEO: proper metadata (title, description, OG tags, Twitter card), semantic HTML (`h1`–`h3` hierarchy), structured data for FAQ section (`FAQPage` schema).
- Accessibility: WCAG AA — color contrast, keyboard navigation, alt text on all product visuals, reduced-motion support (`prefers-reduced-motion`).
- Component structure: one component per section (`Hero.tsx`, `WhyQcontrol.tsx`, `ProductOverview.tsx`, etc.) under a `components/landing/` directory, composed in the `/` page route.
- Pricing data: extract into a typed config file (e.g. `data/pricing.ts`) so plans/prices can be edited without touching markup.
- No new backend calls, no new Supabase tables, no auth changes. Static/marketing content only, aside from existing "Get Started" auth redirect.

---

## 6. Deliverables

1. Full landing page implementation replacing the current one at `/`.
2. Modular, section-based components as specified in §5.
3. Configurable pricing data file.
4. Placeholder markers (clearly commented) for any unresolved content — pricing, testimonials, real screenshots.
5. Brief summary of any assumptions made or content gaps flagged during the build.

---

## 7. Acceptance Criteria

- All 14 sections present, in the specified order, with no content omitted.
- No fabricated features, metrics, or pricing.
- No emojis.
- Brand terminology (Qcontrol, QKhata, Qpulse, etc.) preserved exactly.
- Fully responsive and functional in both light and dark mode.
- No modification to any file outside the landing page's rendering layer.
