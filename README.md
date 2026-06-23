# 🎱 Billiards QR Session & Billing Tracker

A modern, responsive, QR-based station tracking and automated billing system built specifically for Billiards, Snooker, and Pool clubs. 

This application seamlessly tracks playtime for individual tables, automatically calculates pricing based on structured time increments, and securely stores all session data directly into Google Sheets for reliable, scalable, and free database management.

---

## ✨ Features

- **QR Code Integration**: Quickly start or end sessions by scanning a table-specific QR code. No manual entry needed.
- **Automated Billing Engine**: 
  - Automatically calculates session cost.
  - Bills in strict 15-minute increments for simplified accounting.
  - Fixed pricing logic for different game types (Snooker vs Pool).
- **Google Sheets Database**: Completely serverless database using Google Sheets. Highly scalable (up to 10 million cells) and easily accessible for exporting/analytics.
- **Real-Time Tracking**: Clean, responsive UI with live session timers indicating elapsed playtime.
- **Mobile Responsive**: Built with Tailwind CSS ensuring optimal experience for staff using mobile devices to scan.

## 🛠️ Technology Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Language**: TypeScript
- **Database**: Google Sheets API (via `googleapis`)

---

## 🚀 Local Setup & Installation

### 1. Prerequisites
- Node.js (v18 or higher)
- A Google Cloud Console project with the **Google Sheets API** enabled.
- A Google Service Account with a downloaded JSON key.

### 2. Clone the Repository
```bash
git clone https://github.com/angarak994/Billiards_QR_sessions.git
cd Billiards_QR_sessions
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Environment Variables
Create a `.env.local` file in the root directory. **NEVER commit this file to version control**. The `.gitignore` is pre-configured to ensure this stays secure.

Add your Google Service Account credentials:
```env
GOOGLE_SHEETS_SPREADSHEET_ID="your-spreadsheet-id-here"
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account-email"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 5. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📦 Deployment (Vercel)

This project is optimized for deployment on Vercel.

1. Push your code to your GitHub repository.
2. Sign in to [Vercel](https://vercel.com) and import the repository.
3. Under **Environment Variables**, add the three `GOOGLE_` keys from your `.env.local` file.
4. Click **Deploy**.

*Note: Once deployed, ensure you update your QR Code generation script to use your new live Vercel URL as the base URL instead of `localhost`.*

---

## 🔒 Security Posture

- **Environment Secrets**: Database credentials (Google Service Account keys) are isolated in environment variables. They are securely injected into the Next.js server-side API routes and are never exposed to the client/browser.
- **Safe Commits**: The `.gitignore` explicitly blocks `.env` and `.env.local` from being tracked by git.
- **Type Safety**: Fully typed with TypeScript to prevent runtime errors and injection vulnerabilities.
- **Strict Linting**: Verified against strict ESLint rules ensuring no memory leaks or unexpected cascading renders.

---

*Designed for efficient club management. Clean, simple, and automated.*
