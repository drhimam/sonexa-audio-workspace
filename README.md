# 🎙️ Sonexa — Local-First Audio Intelligence & Cloudflare Sync

[![GitHub Stars](https://img.shields.io/github/stars/drhimam/sonexa-audio-workspace?style=flat-square)](https://github.com/drhimam/sonexa-audio-workspace)
[![Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-f38020?style=flat-square&logo=cloudflare)](https://pages.cloudflare.com)
[![IndexedDB](https://img.shields.io/badge/Local%20First-Dexie.js%20(IDB)-10a37f?style=flat-square)](https://dexie.org)
[![Email](https://img.shields.io/badge/Transactional%20Email-ZeptoMail-blue?style=flat-square)](https://www.zoho.com/zeptomail/)
[![License](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](LICENSE)

**Sonexa** is an AI-powered audio transcription, analysis, and document generation workbench. It offers a **dual-mode architecture**:
1. **100% Local-First Mode:** Works immediately in your browser using IndexedDB. No sign-in required, zero latency, full data privacy, and works completely offline.
2. **Cloudflare Edge Sync Mode:** Optional opt-in multi-device synchronization powered by **Cloudflare D1** (Serverless SQLite) and **Cloudflare R2** (for audio storage), with account security verified through **ZeptoMail transactional emails**.

---

## 🌟 Key Features

- **🎙️ Multi-Source Audio Capture & Meeting Mode:** Record directly from your **Microphone**, **Computer System Audio** (YouTube, podcasts, video playback), or **Meeting Mode** (dual-stream Web Audio mixer capturing both your mic and remote participants from Zoom, Microsoft Teams, Google Meet, and Webex).
- **💻 Desktop Installable (PWA) & Mobile Adaptive:** Installable as a standalone native-feeling desktop app on Windows, macOS, Linux, and ChromeOS. Mobile-adaptive design with touch-friendly controls and an off-canvas navigation drawer.
- **📦 Whole-Database JSON Backup & Transfer:** One-click full database export and import with base64 audio serialization for instant cross-device data transfers and backups.
- **⚡ Multi-Model AI Transcription:** Connect OpenAI Whisper, Deepgram Nova-2, Groq Whisper Large v3, or private local models via Ollama.
- **✨ Intelligent Enhancement:** Automatic stutter removal, punctuation correction, executive summaries, and key topic extraction.
- **💬 Grounded Audio Chat:** Converse directly with your transcript. Every answer is linked to precise timestamps for verification.
- **📑 Structured Document Generator:** Instant generation of Executive Briefs, Meeting Action Items, Technical Specs, Study Guides, and Blog Posts.
- **☁️ Cloudflare Multi-Device Sync:** Bidirectional delta synchronization between local Dexie IndexedDB and Cloudflare D1 with Last-Write-Wins conflict resolution.
- **📧 ZeptoMail Verified Security:** Fast OTP-based sign-up verification and secure password recovery via Zoho's ZeptoMail REST API.


---

## 🏗️ Architecture

```
                                  ┌─────────────────────────────┐
                                  │      Client Browser         │
                                  │   (Vite + React 18 + CSS)   │
                                  └──────┬───────────────┬──────┘
                                         │               │
                        [Unauthenticated]│               │[Authenticated Sync]
                                         ▼               ▼
                                 ┌──────────────┐   ┌───────────────────────────┐
                                 │ Local Dexie  │   │ Cloudflare Edge Functions │
                                 │  (IndexedDB) │   │ (/api/auth & /api/sync)   │
                                 └──────────────┘   └─────┬───────┬───────┬─────┘
                                                          │       │       │
                                    ┌─────────────────────┘       │       └──────────────────┐
                                    ▼                             ▼                          ▼
                           ┌──────────────────┐          ┌─────────────────┐        ┌─────────────────┐
                           │  Cloudflare D1   │          │  Cloudflare R2  │        │  ZeptoMail API  │
                           │ (Users, Tokens,  │          │ (Audio Storage  │        │ (OTP & Password │
                           │  Sync Folders)   │          │  Backups)       │        │  Reset Emails)  │
                           └──────────────────┘          └─────────────────┘        └─────────────────┘
```

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js 18+ (tested on Node.js v24)
- npm or pnpm

### 1. Clone & Install
```bash
git clone https://github.com/drhimam/sonexa-audio-workspace.git
cd sonexa-audio-workspace
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

- Click **Launch Free Workspace** to test the 100% local-first mode without logging in.
- Click **Connect Cloud / Sign In** to test the account creation and OTP verification flow.

---

## ⛅ Cloudflare Deployment Guide

### 1. Create Cloudflare D1 Database
Make sure you are logged in via Wrangler (`npx wrangler login`):
```bash
npx wrangler d1 create sonexa-db
```
Copy the generated `database_id` and update it in [`wrangler.toml`](file:///d:/02.%20MY-PROJECT/ANTiGRAvity/sonexa-audio-workspace/transcriber-apps/wrangler.toml):
```toml
[[d1_databases]]
binding = "DB"
database_name = "sonexa-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 2. Apply Database Schema Migrations
```bash
# Apply to local development database:
npm run d1:migrate:local

# Apply to Cloudflare remote production database:
npm run d1:migrate:remote
```

### 3. Configure ZeptoMail Secrets
Set your ZeptoMail Send Mail Token in Cloudflare Pages (or via the Cloudflare Dashboard under Project Settings > Environment variables):
```bash
npx wrangler pages secret put ZEPTOMAIL_API_KEY --project-name sonexa
# Enter: Zoho-enczapikey <YOUR_TOKEN> (or raw token)

npx wrangler pages secret put ZEPTOMAIL_FROM_ADDRESS --project-name sonexa
# Enter your verified sender: info@yourdomain.com

# Optional regional endpoint (e.g. https://api.zeptomail.ca/v1.1/email or https://api.zeptomail.eu/v1.1/email):
npx wrangler pages secret put ZEPTOMAIL_ENDPOINT --project-name sonexa
```

### 4. Deploy Frontend & API to Cloudflare Pages
```bash
npm run deploy
```
Your application will be live at `https://sonexa.pages.dev` with edge API functions active.

---

## 🔒 Security & Privacy Model

- **Zero-Trust Audio Isolation:** In Local Mode, audio never leaves your browser.
- **Web Crypto PBKDF2:** Passwords hashed with 100,000 iterations of SHA-256 and cryptographic salts.
- **Serverless Secrets:** ZeptoMail Send Mail Tokens are stored exclusively in Cloudflare Worker encrypted secrets, never exposed to client browsers.

---

## 📂 Project Structure

```
├── functions/                     # Cloudflare Pages Functions (Edge API)
│   ├── api/
│   │   ├── _middleware.ts         # CORS & Preflight handler
│   │   ├── auth/                  # Signup, Verify, Signin, Resend, Reset
│   │   └── sync/                  # Pull & Push delta sync endpoints
│   └── lib/                       # Web Crypto & ZeptoMail REST client
├── migrations/
│   └── 0001_initial_schema.sql    # Cloudflare D1 SQL schema
├── src/
│   ├── components/                # UI Components (LandingPage, AuthModal, Workspace)
│   ├── lib/                       # Hooks (useAuth, db, sync, ai, audio)
│   ├── App.tsx                    # Root application controller
│   └── main.tsx                   # React DOM entry point
├── doc/                           # Implementation logs and architecture
│   ├── plan.md                    # In-depth architectural blueprint
│   └── implementation.md          # Chronological history & lessons learned
├── wrangler.toml                  # Cloudflare Pages & D1 binding configuration
└── README.md                      # GitHub overview and setup
```

---

## 📄 License
MIT License. Created by [Md Hasan Imam](https://github.com/drhimam).
