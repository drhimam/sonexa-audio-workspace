# Sonexa Audio Workspace — Architecture & Implementation Plan

## 1. Executive Summary & Vision

**Sonexa** is an AI-powered, privacy-respecting audio transcription and intelligence workbench. It operates with a **dual-mode architecture**:
1. **Local-First Mode (Zero Setup / Full Privacy):** Works 100% in the user's browser using IndexedDB (Dexie.js). No account, sign-in, or internet connection required. Audio binaries and transcripts remain strictly on the local machine.
2. **Cloudflare Sync Mode (Opt-In Multi-Device Sync):** Users can create an account, verify their email address via **ZeptoMail**, and securely synchronize their sessions, folders, documents, and transcripts across multiple devices using **Cloudflare D1** (Serverless SQLite) and **Cloudflare R2** (for audio storage).

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Frontend (Vite + React)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Landing Page  │  Auth Modals (Sign In, Sign Up, OTP, Forgot) │  Workspace  │
└───────┬────────────────────────────────┬──────────────────────────┬─────────┘
        │                                │                          │
        ▼                                ▼                          ▼
┌──────────────────┐          ┌──────────────────────┐    ┌───────────────────┐
│ Local State      │          │ Sync Engine          │    │ AI Engine         │
│ (Dexie.js / IDB) │ ◄──────► │ (Delta LWW Sync)     │    │ (OpenAI, Groq,    │
│ Sessions, Folders│          └──────────┬───────────┘    │ Deepgram, Ollama) │
└──────────────────┘                     │                └───────────────────┘
                                         │ (HTTPS REST API)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Cloudflare Pages Functions / Workers Backend                │
├─────────────────────────────────────────────────────────────────────────────┤
│   /api/auth/signup         /api/auth/verify         /api/auth/signin        │
│   /api/auth/forgot         /api/auth/reset          /api/auth/me            │
│   /api/sync/pull           /api/sync/push           /api/mail/send          │
└───────┬────────────────────────────────┬──────────────────────────┬─────────┘
        │                                │                          │
        ▼                                ▼                          ▼
┌──────────────────┐          ┌──────────────────────┐    ┌───────────────────┐
│  Cloudflare D1   │          │  Cloudflare R2       │    │  ZeptoMail API    │
│ (Users, Tokens,  │          │ (Audio Blobs / Media │    │ (Transactional    │
│  Synced Data)    │          │  Buckets)            │    │  Email Service)   │
└──────────────────┘          └──────────────────────┘    └───────────────────┘
```

---

## 3. Database Schema

### A. Local IndexedDB (Dexie.js)
Maintained in `src/lib/db.ts`:
- **`sessions`**: `id, createdAt, updatedAt, status, folderId, title, durationSec, mimeType, source, transcript, enhancedTranscript, chat, documents, savedItems, tags, isSynced`
- **`folders`**: `id, createdAt, updatedAt, name, isSynced`
- **`audio`**: `id, blob, createdAt`
- **`settings`**: `id, value`
- **`sync_queue`**: `id, entity, entityId, action ('create'|'update'|'delete'), payload, timestamp`

### B. Cloudflare D1 (SQL Schema)
File: `migrations/0001_initial_schema.sql`:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    email_verified INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Verification and password reset tokens
CREATE TABLE IF NOT EXISTS auth_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email_verification', 'password_reset', 'session')),
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Cloud synchronized folders
CREATE TABLE IF NOT EXISTS folders (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Cloud synchronized sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    folder_id TEXT,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    data_json TEXT NOT NULL, -- JSON blob of transcripts, chat, documents
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for fast sync lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_updated ON sessions(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_folders_user_updated ON folders(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON auth_tokens(token, type);
```

---

## 4. Authentication & ZeptoMail Architecture

### A. Authentication Flows
1. **Sign Up:**
   - User inputs Name, Email, and Password.
   - Password hashed client-side or server-side via Web Crypto (PBKDF2 with SHA-256 and 100,000 iterations).
   - Server creates user record with `email_verified = 0`.
   - Generates 6-digit numeric OTP and 24-hour token.
   - Dispatches formatted HTML verification email via **ZeptoMail**.
2. **Email Verification:**
   - User enters 6-digit OTP code or clicks the verification link with token.
   - Server verifies token in `auth_tokens`, marks `email_verified = 1`, and deletes used token.
   - Issues active session JWT/token.
3. **Sign In:**
   - User inputs Email + Password.
   - Server verifies password against stored hash + salt.
   - If `email_verified == 0`, prompts to complete verification with "Resend Code" option.
   - Sets secure session token and enables Cloud Sync.
4. **Forgot Password:**
   - User inputs registered email.
   - Server generates a 15-minute password reset OTP/token.
   - Sends reset instructions via ZeptoMail.
5. **Reset Password:**
   - User enters OTP/token and new password.
   - Validates token, updates password hash/salt, and invalidates existing sessions.

### B. ZeptoMail API Integration
- **Endpoint:** `https://api.zeptomail.com/v1.1/email`
- **Method:** `POST`
- **Header:** `Authorization: Zoho-enczapikey <ZEPTOMAIL_SEND_MAIL_TOKEN>`
- **Payload Format:**
```json
{
  "bounce_address": "bounce@yourdomain.com",
  "from": {
    "address": "noreply@yourdomain.com",
    "name": "Sonexa Audio"
  },
  "to": [
    {
      "email_address": {
        "address": "user@example.com",
        "name": "User Name"
      }
    }
  ],
  "subject": "Verify your email - Sonexa Audio Workspace",
  "htmlbody": "<div>...styled HTML template...</div>"
}
```

---

## 5. Bidirectional Sync Protocol (Local <-> Cloud)

1. **Last-Write-Wins (LWW) with Conflict Resolution:**
   - Every session and folder has an `updatedAt` Unix timestamp.
   - **Pull:** Client sends `lastSyncTime`. Server returns all items where `updated_at > lastSyncTime`.
   - Client merges incoming items: if `incoming.updatedAt > local.updatedAt`, local copy is updated.
   - **Push:** Client uploads local changes where `updatedAt > lastSyncTime`.
   - Server updates D1 database records.
2. **Selective Audio Sync:**
   - Audio blobs are heavy (often 10MB - 100MB+).
   - In Settings, users have an explicit toggle: `"Sync Audio Recordings to Cloud"`.
   - If turned off: only metadata, transcripts, chat, and documents sync (ultra-fast, minimal bandwidth).
   - If turned on: audio is uploaded to Cloudflare R2 via presigned PUT URLs.

---

## 6. Implementation Phases

| Phase | Milestone | Deliverables |
|-------|-----------|--------------|
| **Phase 1** | Git & Repository Initialization | Initial commit, GitHub repository, remote branch `main`. |
| **Phase 2** | Landing Page & Authentication UI | Landing page, Hero, Feature grid, Sign In / Sign Up modals, OTP screen, Forgot Password. |
| **Phase 3** | Cloudflare Functions & ZeptoMail Backend | `functions/api/auth/*`, `functions/api/sync/*`, ZeptoMail email client, D1 SQL migrations. |
| **Phase 4** | Local-First & Sync Engine Integration | Sync manager, sync status badge, settings toggle, conflict resolution. |
| **Phase 5** | Cloudflare Pages Deployment & Documentation | Wrangler configuration, production build validation, deployment scripts, `README.md`, `doc/implementation.md`. |
