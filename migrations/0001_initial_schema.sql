-- Cloudflare D1 Initial Schema for Sonexa Audio Workspace

-- 1. Users Table
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

-- 2. Auth Tokens (Verification OTPs, Password Reset Codes, Sessions)
CREATE TABLE IF NOT EXISTS auth_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email_verification', 'password_reset', 'session')),
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Cloud Synchronized Folders
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

-- 4. Cloud Synchronized Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    folder_id TEXT,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    data_json TEXT NOT NULL, -- Serialized JSON containing transcripts, chat messages, documents
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_tokens_lookup ON auth_tokens(token, type);
CREATE INDEX IF NOT EXISTS idx_sessions_sync ON sessions(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_folders_sync ON folders(user_id, updated_at);
