# Sonexa Audio Workspace — Implementation History & Lessons Learned

## 1. Project Inception & Baseline State

### Initial Inspection
- **Source Code Base:** The application was bootstrapped as a local-first audio transcription workspace using React 18, Vite 7, TypeScript, TailwindCSS, and Dexie (IndexedDB).
- **Core Strengths Discovered:**
  - Multi-provider AI audio transcription architecture (OpenAI Whisper, Deepgram Nova-2, Groq Whisper-large-v3, Ollama local whisper).
  - LLM transcript intelligence (segment enhancement, automated summaries, key topic extraction, transcript-grounded conversational chat).
  - Document generation for meetings, action items, executive briefs, and study guides.
  - Robust local-first persistence using Dexie 4 with separate tables for metadata and large audio blobs.
- **Initial Gaps Identified:**
  - Dependencies were not installed (`node_modules` missing).
  - Git repository was uninitialized.
  - No landing page or public-facing marketing presentation (loaded directly into empty workspace).
  - No user identity, registration, login, email verification, or password recovery.
  - No cloud synchronization mechanism to preserve data across devices.
  - No integration with Cloudflare infrastructure (D1, R2, Workers) or ZeptoMail transactional email service.

---

## 2. Struggles Encountered & Technical Lessons Learned

### Struggle 1: PowerShell Command Chaining (`&&` vs `;`)
- **Issue:** Running chained commands like `git add . && git commit -m "..."` failed in Windows PowerShell with:
  ```
  The token '&&' is not a valid statement separator in this version.
  ```
- **Cause:** Native Windows PowerShell (v5.1/older) does not support POSIX `&&` operators, which were only introduced in PowerShell 7+.
- **Lesson & Resolution:** Always use `;` or separate sequential command executions when executing shell commands on Windows PowerShell environments.

### Struggle 2: Browser Sandbox Network Limits for Automated Playwright Tests
- **Issue:** The automated browser subagent encountered network download errors (`404` fetching Playwright win32 binaries from AzureEdge CDN) within the sandbox environment.
- **Cause:** Network egress policies in certain sandboxed runners prevent external binary downloads.
- **Lesson & Resolution:** Rely on direct Vite dev server process verification (`manage_task` status checks, clean TypeScript compilation, and production build verification) rather than relying exclusively on automated browser driver downloads when sandbox restrictions apply.

### Struggle 3: Preserving "Local-First" While Introducing "Cloud Sync"
- **Architectural Challenge:** Traditional web applications force users to create an account before doing anything. For an audio recording workspace, forcing immediate sign-up causes friction and violates local privacy principles.
- **Lesson & Resolution:** Implement a **zero-barrier local-first pattern**:
  - Anonymous users can immediately record, transcribe, chat, and generate documents with 100% of data retained in local IndexedDB.
  - Authentication and Cloudflare D1/R2 sync are treated as an **opt-in upgrade**: signing up links local sessions to the user's cloud account and begins background delta synchronization with conflict resolution.

### Struggle 4: Secure Transactional Email via ZeptoMail
- **Security Challenge:** ZeptoMail uses an API Send Mail Token (`Zoho-enczapikey`). Exposing this key in client-side Vite code would compromise the user's email sending quota and domain reputation.
- **Lesson & Resolution:** Route all authentication email triggers (Email Verification OTP, Password Reset OTP) through a serverless backend proxy (Cloudflare Pages Functions / Workers) where `ZEPTOMAIL_API_KEY` is securely stored as an encrypted Cloudflare secret environment variable.

### Struggle 5: Cross-Platform Edge Runtime Compatibility (No Node.js Crypto)
- **Challenge:** Node.js modules like `crypto.pbkdf2Sync` or `bcrypt` cannot run on edge workers without bulky polyfills.
- **Lesson & Resolution:** Used native **Web Crypto API** (`crypto.subtle.importKey` and `crypto.subtle.deriveBits` with PBKDF2 and SHA-256). This executes natively with zero external dependencies in both Cloudflare Workers/Pages Functions and modern web browsers.

---

## 3. Implementation Chronology by Phase

### Phase 1: Environment Setup, Dependency Resolution & Git Initialization
- Verified Node.js v24.19.0 and npm 11.17.0.
- Executed `npm install` (resolved 287 packages cleanly).
- Validated TypeScript types (`npm run typecheck` passed with 0 errors).
- Tested production bundle generation (`npm run build` completed in 2.52s).
- Updated `.gitignore` to safeguard `.wrangler/`, `.env*`, and build outputs.
- Initialized local Git repository, created initial commit on branch `main`.
- Created remote repository on GitHub via `gh repo create sonexa-audio-workspace --public --source=. --remote=origin --push`.
- Verified repository published at: [https://github.com/drhimam/sonexa-audio-workspace](https://github.com/drhimam/sonexa-audio-workspace).

### Phase 2: Landing Page & Authentication UI
- Created `src/components/LandingPage.tsx`:
  - Aesthetic hero section with ambient glow and live animated audio waveform visualizer.
  - Direct call-to-action: "Launch Free Workspace (No Sign-Up)" for instant local-first access.
  - Secondary CTA: "Sign Up for Cloudflare Sync" for multi-device sync.
  - Interactive feature preview tabs (Transcript, AI Enhanced Summary, Ask Audio Chat, Structured Action Items).
  - Feature capability grid detailing local privacy, multi-model AI, and ZeptoMail integration.
  - Comparative analysis matrix: Local-First Mode vs. Cloudflare Edge Sync.
- Created `src/components/AuthModal.tsx`:
  - 5-in-1 modal supporting Sign In, Sign Up, 6-digit OTP Email Verification, Forgot Password, and Password Reset.
  - Integrated resend cooldown timers and instant validation feedback.
  - ZeptoMail verification badge and security indicators.
- Created `src/lib/useAuth.ts`:
  - Hook managing user credentials, session tokens, verification status, and Cloudflare sync toggles.
  - Graceful local simulation fallback so developers and demo users can test complete flows even before Cloudflare database provisioning.

### Phase 3: Cloudflare Backend Functions & ZeptoMail Service
- Configured Cloudflare Pages Functions under `functions/`:
  - `functions/api/_middleware.ts`: Global CORS and OPTIONS preflight handling.
  - `functions/lib/crypto.ts`: Web Crypto PBKDF2 hashing, salt generation, and secure OTP generator.
  - `functions/lib/zeptomail.ts`: ZeptoMail REST API client dispatching formatted, responsive HTML verification and password reset emails.
  - `functions/api/auth/signup.ts`: User registration and OTP dispatch.
  - `functions/api/auth/verify.ts`: OTP code verification, email confirmation, and session issuance.
  - `functions/api/auth/signin.ts`: Secure credential verification and session token generation.
  - `functions/api/auth/resend.ts`: New verification OTP dispatch via ZeptoMail.
  - `functions/api/auth/forgot-password.ts`: Password reset OTP dispatch via ZeptoMail.
  - `functions/api/auth/reset-password.ts`: Password update and token invalidation.
- Created `migrations/0001_initial_schema.sql` for Cloudflare D1 SQLite database (users, auth_tokens, folders, sessions).
- Created `wrangler.toml` configuring Cloudflare Pages output, D1 database bindings, and environment variables.

### Phase 4: Local-First + Cloud Sync Protocol
- Built `src/lib/sync.ts`:
  - `runBidirectionalSync`: Two-phase delta sync mechanism with timestamp-based Last-Write-Wins (LWW) conflict resolution.
  - Pull phase merges remote folder and session updates into local IndexedDB.
  - Push phase uploads local offline modifications to Cloudflare D1.
- Updated `src/App.tsx`:
  - Seamless navigation toggle between Landing Page and Workspace.
  - Header Cloud Sync Status indicator (🟢 *Cloud Synced*, 🟡 *Syncing...*, ⚪ *Connect Cloud*).
  - Automatic background synchronization every 60 seconds when authenticated.
  - User profile menu with account email, ZeptoMail verified badge, sync status, and sign-out control.

### Phase 5: Documentation & GitHub Artifacts
- Authored `doc/plan.md`: Comprehensive system architecture, data models, auth flows, and sync protocol specifications.
- Authored `doc/implementation.md`: Technical history, struggles encountered, and lessons learned.
- Authored root `README.md`: High-impact GitHub documentation with badges, architecture diagrams, local development setup, and Cloudflare deployment instructions.
- Authored `.env.example`: Clear environment variables template for ZeptoMail and Cloudflare.
- Added npm deployment and migration scripts in `package.json` (`d1:migrate:local`, `d1:migrate:remote`, `pages:dev`, `deploy`).

---

## 4. Live Production Terminal Deployment (Cloudflare Pages & D1)

### Execution Summary
- **Database Provisioning:** Successfully created Cloudflare D1 serverless database:
  - Database Name: `sonexa-db`
  - Region: `ENAM`
  - Database ID: `5dc09d8f-5fe1-45bc-b5bd-736746d16840`
  - Bound in `wrangler.toml` under binding `DB`.
- **Database Migration:** Applied `migrations/0001_initial_schema.sql` directly to the remote production D1 instance:
  - Tables created: `users`, `auth_tokens`, `folders`, `sessions`.
  - Indexes created: `idx_users_email`, `idx_tokens_lookup`, `idx_sessions_sync`, `idx_folders_sync`.
- **Pages Project Creation:** Created project `sonexa` on Cloudflare Pages attached to production branch `main`.
- **Production Asset & Functions Build:** Compiled React/Vite client and edge functions bundle.
- **Production Deployment:** Deployed via `wrangler pages deploy dist --project-name sonexa --branch main`:
  - Production URL: **[https://sonexa.pages.dev](https://sonexa.pages.dev)**
  - Direct Deployment URL: **https://9adffccf.sonexa.pages.dev**
- **Verification:** Verified live HTTP response and asset delivery via edge CDN.

---

## 5. Complete Database Export & Import (Cross-Device Data Transfer)

### Motivation & Requirement
Users wanted a complete offline data migration and transfer mechanism so that all sessions, transcripts, generated documents, folders, audio recordings, and provider configurations could be transferred or backed up to any computer, smartphone, or browser via a single portable JSON file.

### Implementation Architecture
- **Library (`src/lib/databaseBackup.ts`):**
  - `exportDatabaseToJson`: Reads all records from Dexie tables (`sessions`, `folders`, `audio`, `settings`). Serializes binary audio blobs into base64 DataURLs using `FileReader` so they remain valid within standard JSON.
  - `downloadDatabaseBackup`: Automates downloading the generated JSON bundle with formatted naming (`sonexa-database-backup-YYYY-MM-DD-full.json`).
  - `inspectBackupFile`: Reads candidate JSON files, verifies schema validity and `app: 'Sonexa Audio Workspace'`, and produces an inspection summary (session count, folder count, audio recording count) before executing import.
  - `importDatabaseFromJson`: Executes atomic Dexie transactions with two user-selected modes:
    - **Merge Mode (Safe):** Inserts or updates incoming sessions, folders, and audio blobs while preserving existing local records.
    - **Replace Mode:** Atomically clears local tables and restores the exact state from the JSON backup file.
- **UI (`src/components/DataBackupModal.tsx`):**
  - Tabbed interface for **Export** and **Import**.
  - Backup options: **Complete Backup** (includes audio files) vs. **Lightweight Text Backup** (fast, smaller file size).
  - Real-time progress indicators showing percentage and serialization state.
  - File inspection preview displaying item counts prior to confirmation.
  - Accessible via the **Workspace Header** (Database icon), **Sidebar footer** ("Backup / Transfer"), and the **AI Settings Modal**.

---

## 6. System Audio & Meeting Recording Architecture (Zoom, Teams, Meet & Media Playback)

### The Challenge
- Standard browser `navigator.mediaDevices.getUserMedia({ audio: true })` only captures the user's physical microphone.
- When attending remote meetings (Zoom, Microsoft Teams, Google Meet, Slack Huddles, Discord) or watching video lectures (YouTube, Coursera, Loom), the audio originating from other attendees and computer speakers cannot be captured by mic input alone.
- Capturing meeting audio requires recording **both** the user's voice (Mic) AND the remote attendees' voices (System Audio) into a single, synchronized stream without feedback loops.

### Technical Solution: Web Audio API Dual-Stream Mixer
1. **Source Capture:**
   - **Microphone Stream:** Captured via `navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })`.
   - **System Audio Stream:** Captured via `navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false } })`. By passing `{ video: true, audio: true }`, modern browsers (Chrome, Edge, Brave, Opera) render the system screen/tab/window picker with the crucial **"Share audio"** or **"Also share system audio"** toggle.
2. **Audio Graph Virtual Mixer:**
   - Created an `AudioContext` and an `AudioDestinationNode` via `audioContext.createMediaStreamDestination()`.
   - Routed the microphone stream through `audioContext.createMediaStreamSource(micStream)`.
   - Routed the display/system audio track through `audioContext.createMediaStreamSource(displayStream)`.
   - Connected both source nodes into the single destination node, summing both signals into a clean stereo mix.
   - Initialized `MediaRecorder` targeting the mixed audio stream (`destinationNode.stream.getAudioTracks()`).
3. **Graceful Track Cleanup & Life-Cycle Management:**
   - The virtual video track from `getDisplayMedia` is immediately stopped or hidden so it consumes zero display rendering overhead.
   - Listened to the user clicking "Stop sharing" on the browser native banner to gracefully finalize the recording.
   - Audio tracks are automatically closed and the `AudioContext` is suspended/closed when recording terminates.
4. **Three Intuitive Recording Modes:**
   - 🎙️ **Microphone Only:** Ideal for personal voice memos, dictation, solo brainstorming.
   - 🔊 **System Audio Only:** Ideal for transcribing YouTube videos, podcasts, Loom recordings, or pre-recorded webinars without picking up room noise.
   - 👥 **Meeting Mode (Mic + System Audio):** Specifically designed for Zoom, Microsoft Teams, Google Meet, and Webex calls to record both the user and all call participants.
5. **UI Guidance:** Added a persistent instructional banner alerting users to check the **"Share tab audio"** or **"Also share system audio"** checkbox in the browser picker.

---

## 7. Desktop Installability (PWA) & Mobile Adaptive Design

### A. Desktop Installability (Progressive Web App - PWA)
- **Web App Manifest (`public/manifest.json`):**
  - Configured with `display: "standalone"`, `orientation: "any"`, `background_color: "#0a0c10"`, and `theme_color: "#6366f1"`.
  - Defined high-res SVG app icons (`icon-192.svg`, `icon-512.svg`) and quick launch shortcuts for Direct Recording and Document Generator.
- **Service Worker (`public/sw.js`):**
  - Registered in `index.html`.
  - Implements stale-while-revalidate and network-first caching strategies for shell assets.
  - Satisfies Chromium and Safari PWA installation criteria.
- **Install Hook (`src/lib/usePwaInstall.ts`):**
  - Intercepts the window's `beforeinstallprompt` event and stores the deferred prompt.
  - Detects if the app is already running in standalone mode (`window.matchMedia('(display-mode: standalone)').matches`).
  - Provides a 1-click `promptInstall()` method triggering the native operating system desktop installation prompt on Windows, macOS, ChromeOS, and Android.
- **App Install Controls:**
  - Placed an **"Install App"** desktop action button with a computer icon in the main workspace header.
  - Placed an installation banner in the mobile drawer navigation.

### B. Mobile Adaptive Responsive Layout
- **Mobile Off-Canvas Navigation Drawer:**
  - On viewports < 768px, the static desktop sidebar is converted into an animated slide-over drawer (`Sidebar.tsx`) with a dark backdrop overlay.
  - Added a hamburger menu button (☰) in the mobile header for effortless one-thumb drawer toggling.
  - Clicking any session, folder, or backdrop smoothly dismisses the drawer.
- **Touch-Friendly Controls:**
  - Expanded tap targets to minimum 44px for primary record, pause, and stop controls.
  - Reorganized the multi-source selector (`RecorderPanel.tsx`) into a fluid responsive grid (`grid-cols-1 sm:grid-cols-3`).
  - Adapted the `DataBackupModal` and `AuthModal` to render with scrollable viewports on small screens.

---

## 8. Meeting Mode Default Configuration & Quality Assurance

### Motivation & UX Rationale
Remote conferencing (Zoom, Google Meet, Microsoft Teams, Slack Huddles, Webex) is the most frequent audio recording use case for workspace users. Defaulting to standard mic-only capture frequently caused missed remote participant audio because users would start recording without remembering to switch source modes first.

### Changes Implemented
1. **Audio Hook Defaults (`src/lib/useRecorder.ts`):**
   - Configured `useRecorder(defaultSource: AudioSourceMode = 'meeting')` so that any initialization defaults directly to `'meeting'`.
2. **Recorder Panel UI Refinements (`src/components/RecorderPanel.tsx`):**
   - Initialized with `useRecorder('meeting')`.
   - Reordered source options so **Meeting Mode** is rendered first, followed by **Mic Only** and **System Audio**.
   - Dynamically mapped the icon in the header and the main CTA action button (displaying `Users` for Meeting Mode, `Monitor` for System Audio, and `Mic` for Voice).
   - Displayed helpful setup hints advising users to ensure "Also share audio" is toggled in the browser picker.
3. **Full Quality Assurance & Lint Hardening:**
   - Eliminated all unused imports and variables across `DataBackupModal.tsx`, `EnhancedTranscriptPanel.tsx`, `LandingPage.tsx`, `SettingsModal.tsx`, `StructuredPanel.tsx`, and `Workspace.tsx`.
   - Wrapped `savedItems` with `useMemo` in `Workspace.tsx` to prevent redundant re-renders.
   - Refactored `usePwaInstall.ts` with strict typing on `Navigator.standalone`.
   - Executed and validated:
     - `npm run lint`: **0 errors**.
     - `npm run typecheck`: **0 errors**.
     - `npm run build`: Production bundle compiled cleanly in under 2 seconds.
4. **Cloudflare Edge Deployment & GitHub Synchronization:**
   - Staged and committed changes to local Git repository.
   - Pushed updates to GitHub repository `origin/main`.
   - Deployed updated client assets and edge functions to Cloudflare Pages (`sonexa.pages.dev`).

---

## 9. Plaintext & Markdown Transcript Exports, Focus Mode & Version-Controlled Content

### Motivation & Requirements
1. **Multi-Format Export for Transcripts:** Users required direct, one-click access to download both raw transcripts and AI-enhanced transcripts in standard Plain Text (`.txt`) and Markdown (`.md`) format for archiving, importing into notes apps (Obsidian, Notion, Logseq), and sharing.
2. **Focus Mode / Fullscreen Reader:** Saved documents and chat insights benefit from a distraction-free reading and editing environment free from panels, tabs, and sidebars.
3. **Version-Controlled Editing:** Users need the ability to edit saved summaries, meeting minutes, and chat replies while maintaining a complete, non-destructive audit trail of revisions with 1-click restoration of any historical snapshot.

### Architecture & Changes Implemented
1. **Serialization & Export Engine (`src/lib/export.ts`):**
   - Added `downloadPlainText`: Dispatches UTF-8 plain text file downloads with standard MIME headers.
   - Added `transcriptToPlainText` & `transcriptToMarkdown`: Formats raw transcript segments with timestamps, speakers, and metadata headers.
   - Added `enhancedTranscriptToPlainText` & `enhancedTranscriptToMarkdown`: Structures enhanced transcripts with executive summaries, topic tags, and cleaned dialogue.
   - Exported `slug` utility for sanitized, predictable filenames.
2. **Transcript Views (`TranscriptView.tsx` & `EnhancedTranscriptPanel.tsx`):**
   - Implemented `.txt` and `.md` download action buttons in headers.
   - Passed `sessionTitle` for context-aware, user-friendly filenames.
3. **Domain Model Versioning (`src/lib/types.ts`):**
   - Defined `SavedItemVersion` interface (`id`, `versionNumber`, `title`, `content`, `timestamp`, `note`).
   - Extended `SavedItem` with `updatedAt` and `versions: SavedItemVersion[]`.
4. **Saved Panel with Focus Mode & Version Control (`src/components/SavedPanel.tsx`):**
   - **Focus Mode:** Implemented full-screen distraction-free reader/editor with Escape key listener, reading time estimates, and live word counter.
   - **Markdown Editor:** Integrated write/preview tabs, title editing, optional revision notes, and Tab key indentation.
   - **Version History Engine:** Snapshots previous states before saving new edits or reverting, ensuring zero data loss.
   - **Revision Timeline Drawer:** Displays version numbers, timestamps, notes, with instant snapshot preview and one-click rollback.
   - **Exports:** Supported `.txt`, `.md`, PDF, and clipboard copy for all saved items.
5. **Workspace State Synchronization (`src/components/Workspace.tsx`):**
   - Implemented `updateSavedItem` dispatching session patches that immediately persist to IndexedDB and sync to Cloudflare D1.

---

## 10. Interactive Session Creation Modal & Left Panel Folder Hierarchy Redesign

### Motivation & Requirements
1. **Interactive Session Initiation:** Users wanted to explicitly name their session and select (or create) the target folder at inception, rather than having sessions automatically created with generic timestamps in an unfiled root directory.
2. **Left Panel Visual Prominence:** In the sidebar, folders and session titles previously shared similar font sizes (`15px` vs `14px`) and flat styling, making it difficult to distinguish directory boundaries. Users requested folders to be noticeably larger, distinct, and easily identified at a glance.

### Changes Implemented
1. **New Session Creation Modal (`src/components/NewSessionModal.tsx`):**
   - Replaced silent session initialization with a dedicated creation modal.
   - **Session Title Input:** Pre-populates with an editable default timestamp title (`Session Month Day, Time`) or custom name with Enter-to-submit support.
   - **Folder Location Picker:** Displays selectable folder cards for **Unfiled Library** and each custom folder with active checkmarks and count indicators.
   - **On-the-Fly Folder Creation:** Integrated an inline "+ New folder" toggle right within the modal, allowing users to create and immediately select a new folder without interrupting the session creation flow.
   - **Context-Aware Pre-Selection:** When clicking the inline `+` button on a specific folder in the sidebar, that folder is automatically pre-selected.
2. **Left Panel (Sidebar) Folder Hierarchy Redesign (`src/components/Sidebar.tsx`):**
   - **Distinct Card Styling:** Transformed folder headers from flat text rows into container cards (`border-primary/25 bg-primary/[0.04]` with hover glow and shadow).
   - **Prominent Typography & Sizing:** Enlarged folder titles to `text-base font-bold` (16px bold) and styled icon badges (`w-8 h-8 rounded-lg` with `FolderIcon size={17}`), towering visually over session titles (`text-[13px] font-normal`).
   - **Visual Guide Rails:** Nested sessions beneath each folder inside an indented container with a colored vertical guide line (`pl-3.5 ml-4 border-l-2 border-primary/25`), establishing unmistakable visual grouping.
   - **Session Count Badges:** Displayed vibrant pill badges (`bg-primary/15 text-primary text-xs font-semibold`) for rapid item count recognition.
3. **App Architecture Wireup (`src/App.tsx`):**
   - Routed all "New Session" trigger points (Sidebar main button, folder inline `+`, header top-bar `+ New`, and workspace empty state) through `openNewSessionModal`.
   - Wired `handleCreateFolder` and `handleCreateSession` to persist changes instantly to Dexie IndexedDB.

---

## 11. ZeptoMail Transactional Email Delivery Remediation & Forced Uppercase Folder Styling

### Motivation & Root Cause Analysis
1. **ZeptoMail Delivery Failure Investigation:**
   - **Invalid Bounce Address Rejection:** `functions/lib/zeptomail.ts` previously injected `bounce_address: env.ZEPTOMAIL_FROM_ADDRESS || 'bounce@sonexa.app'`. According to Zoho ZeptoMail API specifications, `bounce_address` is strictly an optional parameter designating a dedicated return-path subdomain configured in the Mail Agent console. Passing a standard sender address (e.g. `info@sonexa.app`) or dummy domain triggers instant HTTP 400 rejection (`TM_3304: Invalid bounce address`).
   - **Silent Failure Masking:** When `sendZeptoEmail` encountered an error, `functions/api/auth/signup.ts` silently swallowed `mailResult.error` and responded with HTTP 200 `{ success: true, emailSent: false }`. The user received a "Verification code sent" message on the client, but no email was actually transmitted.
   - **Deadlock on Unverified Accounts:** Because the unverified user record was committed to Cloudflare D1 before email dispatch, subsequent signup attempts by the user failed with HTTP 409: "An account with this email already exists", locking the user out.
2. **Forced Uppercase Folder Names:**
   - Users requested all folder names to be consistently and strictly forced to uppercase across the sidebar, session creation dialog, move modals, and data storage.

### Changes Implemented
1. **ZeptoMail Client Remediation (`functions/lib/zeptomail.ts`):**
   - **Omitted Optional `bounce_address`:** Removed hardcoded and default sender bounce addresses. Only attaches `payload.bounce_address` if `ZEPTOMAIL_BOUNCE_ADDRESS` is explicitly configured as a dedicated bounce domain.
   - **Token Sanitization:** Automatically cleans leading/trailing whitespace, quotes, and normalizes the required `Zoho-enczapikey <TOKEN>` header format.
   - **Regional Endpoint Normalization:** Automatically resolves endpoints across regions (US `.com`, Canada `.ca`, Europe `.eu`, India `.in`) and ensures the `/v1.1/email` path suffix is present.
   - **Granular Error Extraction:** Parses ZeptoMail structured error responses (`data.error.code`, `data.error.message`, `data.error.details`) to provide actionable diagnostics on failure.
2. **Auth Endpoints Hardening (`signup.ts`, `resend.ts`, `forgot-password.ts`):**
   - **Unverified Account Recovery:** If a user attempts to sign up with an existing email that is not yet verified (e.g. previous email failure), `signup.ts` updates the user's credentials and dispatches a fresh OTP rather than throwing a duplicate conflict.
   - **Atomic Rollback on Mail Failure:** If `sendZeptoEmail` fails during initial registration, newly created unverified records are automatically deleted from D1.
   - **Explicit Error Propagation:** Returns HTTP 400 with the exact ZeptoMail diagnostic error message so the user and developer can identify missing secrets or domain configuration issues immediately.
3. **Non-Sensitive Diagnostics Endpoint (`functions/api/auth/diagnostics.ts`):**
   - Added `GET /api/auth/diagnostics` to safely report D1 database binding status and ZeptoMail secret availability without exposing credential tokens.
4. **Forced Uppercase Folder Names (`App.tsx`, `Sidebar.tsx`, `NewSessionModal.tsx`):**
   - **Input Normalization:** All folder creation and rename inputs transform draft text to `.toUpperCase()` in real time with CSS `uppercase font-semibold tracking-wider`.
   - **Storage Normalization:** Enforced `.trim().toUpperCase()` in `handleCreateFolder` and `handleRenameFolder` prior to saving to Dexie IndexedDB.
   - **Display Transformation:** All folder titles in the sidebar cards, session creation modal, and move-to-folder dialogs render with `.toUpperCase()` and bold uppercase typography.
   - **Data Ingestion Migration:** `refreshLocalData` automatically normalizes loaded folder entities to uppercase on startup.
