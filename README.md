# 🎱 Scan-n-Bill: Multi-Tenant Billiards & Sports Club SaaS

An enterprise-grade, multi-tenant QR-based session tracking, automated billing, and WhatsApp AI receptionist platform built specifically for Billiards, Snooker, and Sports clubs.

Scan-n-Bill transforms how sports clubs manage time-based rentals. By completely removing manual logbooks and introducing real-time QR scanning and autonomous AI booking management, clubs can scale their operations seamlessly.

---

## ✨ Enterprise Features

- **Multi-Tenant Architecture**: A single deployment supports unlimited isolated businesses. Each club gets its own unique Business ID, configuration, pricing rules, tables, AI agent, and dashboard.
- **AI WhatsApp Receptionist**: Fully autonomous AI agent integrated with Twilio. It handles incoming WhatsApp messages, reads live table availability, quotes dynamic pricing, and creates or modifies bookings strictly within the bounds of a specific club's configuration.
- **Dynamic Pricing Engine**: Granular pricing support for dynamic hourly rates, pro-rata minute billing, locked-rate sessions, happy hour automatic discounts, and custom food/beverage additions.
- **Real-Time Dashboard**: A high-performance, real-time command center for club owners to monitor active tables, force-stop sessions, track completed revenue, and manage upcoming bookings.
- **Serverless Google Sheets Sync**: All financial data, memberships, and session logs are automatically synchronized in real-time to a business-specific Google Sheet, providing highly reliable, free, and accessible audit trails.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/) with Turbopack for lightning-fast builds.
- **Language**: Strict TypeScript.
- **Styling**: Tailwind CSS 4 with a bespoke enterprise design system.
- **Database**: Supabase (PostgreSQL) for relational multi-tenant logic + Google Sheets API for robust data export and financial tracking.
- **AI & Integrations**: 
  - OpenAI (GPT-4o) for semantic reasoning and tool calling.
  - Twilio API for WhatsApp Webhook integration.

---

## 🏗️ Architecture Overview

The application follows a strictly decoupled architecture:

1. **Routing Layer**: Edge-ready Next.js App Router for server-rendered dashboards and high-speed API endpoints.
2. **Business Logic Layer**: Core services (`sessionManager.ts`, `billing.ts`) handle all heavy lifting, including complex dynamic pricing algorithms and cross-database synchronization.
3. **Multi-Tenant Data Layer**: The `sessionRepository.ts` abstractly manages dual-writes to both Supabase (the transactional source of truth) and Google Sheets (the analytical data sink).
4. **AI Layer**: The `aiAgent.ts` strictly utilizes OpenAI tool-calling definitions (`start_booking`, `update_booking`, `fetch_status`) ensuring zero-hallucination execution.

---

## 🚀 Local Development & Setup

### 1. Prerequisites
- Node.js (v18 or higher)
- A Supabase Project
- A Google Cloud Console project with the **Google Sheets API** enabled and a Service Account JSON key.
- A Twilio Account (for WhatsApp testing)
- An OpenAI Account

### 2. Clone the Repository
```bash
git clone https://github.com/angarak994/Billiards_QR_sessions.git
cd Billiards_QR_sessions
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Environment Configuration
Copy the provided environment template:
```bash
cp .env.example .env.local
```
Populate `.env.local` with your API keys. **Never commit `.env.local`**. 

### 5. Database Migrations
Run the SQL migrations located in `supabase/migrations/` in sequential order within your Supabase project's SQL editor to generate the necessary multi-tenant tables.

### 6. Run the Application
```bash
npm run dev
```
The application will boot at `http://localhost:3000`.

---

## 📖 API Documentation

The platform exposes several critical REST APIs for integrations and internal use.

### `POST /api/whatsapp-webhook`
- **Description**: Ingests incoming WhatsApp messages via Twilio, identifies the target business based on the receiving number, processes the message via the AI Agent, and returns a response.
- **Authentication**: Twilio Signature Validation (in production).
- **Payload**: Standard Twilio `application/x-www-form-urlencoded` payload.

### `POST /api/onboard-business`
- **Description**: Provisions a new tenant on the platform.
- **Payload**: `{ "business_name": string, "owner_name": string, "owner_email": string, "whatsapp_number": string, "google_sheet_url": string }`
- **Response**: `200 OK` with generated `business_id` and initial API tokens.

### `POST /api/dashboard-data`
- **Description**: Fetches the real-time state of a specific business (active sessions, completed sessions, bookings, revenue).
- **Payload**: `{ "business_id": string }`
- **Response**: Structured JSON containing all dashboard metrics.

---

## 📦 Deployment Readiness

This repository is optimized for edge deployment on platforms like Vercel, Netlify, or Railway.

1. **Build Verification**: Run `npm run build` to ensure there are zero TypeScript or ESLint errors.
2. **Environment Setup**: Add all variables from `.env.example` into your hosting provider's environment settings.
3. **Deploy**: Trigger a production build.

---

## 🔒 Security Posture

- **Tenant Isolation**: Every API endpoint explicitly requires a `business_id` and authenticates the scope of the request to prevent cross-tenant data leakage.
- **Environment Secrets**: All sensitive keys (Google, Supabase, OpenAI, Twilio) are server-side only. Client components only receive sanitized, non-sensitive data.
- **Input Validation**: API routes employ strict type-checking before processing payloads.
- **Zero-Trust UI**: Client-side state is treated as view-only. All destructive actions (e.g., Force Stop Session) must be verified server-side.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
When contributing, please ensure:
1. Code follows existing styling conventions.
2. New features support the multi-tenant architecture.
3. `npm run build` passes locally before submitting a PR.

---

*Scan-n-Bill: Built for performance, designed for scale.*
