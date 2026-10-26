import { useState } from 'react';
import {
  AudioWaveform, Sparkles, Shield, Cloud, Mic, FileText,
  MessageSquare, ArrowRight, CheckCircle2,
  Play, Sun, Moon,
  Cpu, HardDrive, Layers, Download, Monitor, Users,
} from 'lucide-react';

interface LandingPageProps {
  onLaunchWorkspace: () => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onOpenCloudSync?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  isLoggedIn: boolean;
  userName?: string;
  canInstallApp?: boolean;
  onInstallApp?: () => void;
}

export function LandingPage({
  onLaunchWorkspace,
  onOpenAuth,
  onOpenCloudSync,
  theme,
  onToggleTheme,
  isLoggedIn,
  userName,
  canInstallApp,
  onInstallApp,
}: LandingPageProps) {
  const [activeTab, setActiveTab] = useState<'transcribe' | 'enhance' | 'chat' | 'docs'>('transcribe');

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col font-sans selection:bg-primary/20 selection:text-primary">
      {/* 1. NAVIGATION BAR */}
      <nav className="sticky top-0 z-40 surface/80 backdrop-blur-md border-b border-app">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-soft">
              <AudioWaveform size={20} />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight">Sonexa</span>
              <span className="text-[10px] ml-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">v1.2</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm text-muted">
            <a href="#features" className="hover:text-[var(--text)] transition">Features</a>
            <a href="#workflow" className="hover:text-[var(--text)] transition">How It Works</a>
            <a href="#sync-architecture" className="hover:text-[var(--text)] transition">Local vs Cloud</a>
            <a href="#security" className="hover:text-[var(--text)] transition">Security & Privacy</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              onClick={onToggleTheme}
              className="btn-ghost !p-2 rounded-lg"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {canInstallApp && (
              <button
                onClick={onInstallApp}
                className="btn-outline text-xs !py-1.5 !px-3 font-medium hidden sm:flex items-center gap-1.5"
                title="Install Desktop Application"
              >
                <Download size={13} className="text-primary" />
                <span>Install App</span>
              </button>
            )}
            <button
              onClick={onToggleTheme}
              className="btn-ghost !p-2 rounded-lg"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {isLoggedIn ? (
              <button
                onClick={onLaunchWorkspace}
                className="btn-primary !py-2 !px-4 text-xs font-semibold shadow-soft"
              >
                <span>Workspace ({userName || 'Account'})</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <>
                <button
                  onClick={() => onOpenAuth('signin')}
                  className="btn-ghost text-xs !py-2 !px-3 font-medium"
                >
                  Sign In
                </button>
                <button
                  onClick={onLaunchWorkspace}
                  className="btn-primary !py-2 !px-4 text-xs font-semibold shadow-soft"
                >
                  <span>Launch Free</span>
                  <ArrowRight size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-32">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary/10 dark:bg-primary/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-medium mb-6 animate-fade-in">
            <Sparkles size={14} />
            <span>Local-First Audio Intelligence · Cloudflare Synchronized</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[var(--text)] leading-[1.12]">
            Turn Spoken Words into{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-500 to-teal-400">
              Structured Knowledge
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-muted max-w-3xl mx-auto leading-relaxed">
            Record, upload, and transcribe with <strong>OpenAI Whisper, Deepgram, Groq, or local Ollama</strong>. Capture <strong>Microphone</strong>, <strong>System Audio</strong> (YouTube/videos), and <strong>Zoom/Teams Meeting Calls</strong> directly from your browser or install as a native desktop app.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={onLaunchWorkspace}
              className="btn-primary !py-3.5 !px-6 text-sm font-semibold rounded-xl shadow-soft w-full sm:w-auto flex items-center justify-center gap-2 group"
            >
              <Mic size={18} className="group-hover:scale-110 transition-transform" />
              <span>Launch Free Workspace (No Sign-Up)</span>
              <ArrowRight size={16} />
            </button>

            {canInstallApp && (
              <button
                onClick={onInstallApp}
                className="btn-outline !py-3.5 !px-6 text-sm font-semibold rounded-xl w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <Download size={17} className="text-primary" />
                <span>Install Desktop App</span>
              </button>
            )}

            <button
              onClick={onOpenCloudSync || onLaunchWorkspace}
              className="btn-outline !py-3.5 !px-6 text-sm font-semibold rounded-xl w-full sm:w-auto flex items-center justify-center gap-2"
              title="Connect Google Drive, OneDrive, or WebDAV"
            >
              <Cloud size={17} className="text-primary" />
              <span>Multi-Cloud Sync (Drive, OneDrive, WebDAV)</span>
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-soft">
            <span className="flex items-center gap-1.5">
              <Users size={13} className="text-primary" /> Zoom & Teams Meeting Audio
            </span>
            <span className="flex items-center gap-1.5">
              <Monitor size={13} className="text-primary" /> System Audio & Tab Capture
            </span>
            <span className="flex items-center gap-1.5">
              <Download size={13} className="text-primary" /> Desktop & Mobile PWA
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-primary" /> 100% Offline IndexedDB
            </span>
          </div>

          {/* 3. INTERACTIVE HERO PREVIEW CARD */}
          <div className="mt-14 max-w-4xl mx-auto card p-4 sm:p-6 shadow-soft-dark border border-app surface text-left relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-app">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="text-xs text-muted ml-2 font-mono">Q3 Strategy & Product Sync.wav</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="chip bg-primary/10 text-primary text-[11px] font-medium flex items-center gap-1">
                  <Cloud size={11} /> Cloudflare Synced
                </span>
                <span className="text-xs text-soft">03:42</span>
              </div>
            </div>

            {/* Waveform & audio simulator */}
            <div className="py-4">
              <div className="flex items-center gap-3 surface-2 p-3 rounded-xl border border-app">
                <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 cursor-pointer hover:bg-primary-600 transition">
                  <Play size={16} className="ml-0.5" />
                </div>
                <div className="flex-1 flex items-center gap-1 h-8">
                  {[35, 60, 45, 80, 65, 30, 90, 75, 40, 85, 100, 70, 50, 65, 85, 40, 70, 95, 60, 45, 80, 55, 75, 90, 65, 40, 85, 60, 70, 45, 90, 80, 60, 75, 50, 40, 85, 60].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-full transition-all duration-300"
                      style={{
                        height: `${h}%`,
                        backgroundColor: i < 16 ? '#10a37f' : 'var(--border)',
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs font-mono text-muted shrink-0">01:14 / 03:42</span>
              </div>
            </div>

            {/* Interactive demo tabs */}
            <div className="flex gap-2 border-b border-app pb-2 mb-3">
              {[
                { id: 'transcribe', label: 'Transcript', icon: FileText },
                { id: 'enhance', label: 'AI Enhanced', icon: Sparkles },
                { id: 'chat', label: 'Ask Audio', icon: MessageSquare },
                { id: 'docs', label: 'Structured Docs', icon: Layers },
              ].map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as typeof activeTab)}
                    className={`btn-ghost !px-3 !py-1.5 text-xs rounded-lg flex items-center gap-1.5 ${
                      isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Simulated Content */}
            <div className="min-h-[140px] text-xs text-muted leading-relaxed">
              {activeTab === 'transcribe' && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-mono text-soft shrink-0 mt-0.5">00:04</span>
                    <span className="font-semibold text-[var(--text)] shrink-0">Speaker A:</span>
                    <span>Let's align on the Q3 release schedule and the Cloudflare synchronization layer.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-mono text-soft shrink-0 mt-0.5">00:18</span>
                    <span className="font-semibold text-primary shrink-0">Speaker B:</span>
                    <span className="bg-primary/10 text-[var(--text)] px-1 rounded">The IndexedDB Dexie store guarantees full offline work. The Cloudflare D1 sync will run seamlessly in the background whenever online.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-mono text-soft shrink-0 mt-0.5">00:45</span>
                    <span className="font-semibold text-[var(--text)] shrink-0">Speaker A:</span>
                    <span>And ZeptoMail handles the instant OTP verification codes for new accounts. Perfect.</span>
                  </div>
                </div>
              )}

              {activeTab === 'enhance' && (
                <div className="space-y-2.5">
                  <div className="p-2.5 surface-2 rounded-lg border border-app">
                    <div className="text-[11px] font-semibold text-primary mb-1 flex items-center gap-1">
                      <Sparkles size={12} /> Executive Summary
                    </div>
                    <p className="text-muted">The team reviewed the dual-mode offline architecture: Dexie IndexedDB provides zero-latency local operations, Cloudflare D1 handles cross-device delta sync, and ZeptoMail powers password resets and email verification.</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-soft">Topics:</span>
                    <span className="chip surface-2 text-[10px]">Cloudflare D1</span>
                    <span className="chip surface-2 text-[10px]">ZeptoMail</span>
                    <span className="chip surface-2 text-[10px]">Local-First Dexie</span>
                  </div>
                </div>
              )}

              {activeTab === 'chat' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <span className="font-semibold text-primary">You:</span>
                    <span className="text-[var(--text)]">What was decided regarding email verification?</span>
                  </div>
                  <div className="flex gap-2 p-2 surface-2 rounded-lg">
                    <span className="font-semibold text-emerald-500">AI:</span>
                    <span>Email verification and password resets are powered by <strong>ZeptoMail's transactional REST API</strong>, sending 6-digit OTP codes with zero spam delay.</span>
                  </div>
                </div>
              )}

              {activeTab === 'docs' && (
                <div className="surface-2 p-3 rounded-lg border border-app font-mono text-[11px] space-y-1">
                  <div className="text-primary font-bold"># Action Items — Q3 Architecture Review</div>
                  <div className="text-muted">1. [x] Deploy Cloudflare Pages + D1 Database migrations</div>
                  <div className="text-muted">2. [x] Route ZeptoMail Send Mail Token securely through Worker proxy</div>
                  <div className="text-muted">3. [ ] Configure Cloudflare R2 bucket for high-fidelity audio sync</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. KEY CAPABILITIES GRID */}
      <section id="features" className="py-20 surface-2 border-y border-app">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight">Engineered for Privacy, Speed & Intelligence</h2>
            <p className="mt-3 text-muted text-sm sm:text-base">
              The only audio workbench that gives you absolute local data ownership while supporting multi-device cloud synchronization on demand.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="card p-6 surface hover:border-primary/40 transition">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <HardDrive size={20} />
              </div>
              <h3 className="font-semibold text-base mb-2">100% Local-First Storage</h3>
              <p className="text-sm text-muted leading-relaxed">
                Your recordings and transcripts are saved in browser IndexedDB via Dexie.js. No forced sign-up, zero latency, and complete privacy by default.
              </p>
            </div>

            {/* Card 2 */}
            <div className="card p-6 surface hover:border-primary/40 transition">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4">
                <Cpu size={20} />
              </div>
              <h3 className="font-semibold text-base mb-2">Multi-Provider AI Engine</h3>
              <p className="text-sm text-muted leading-relaxed">
                Connect OpenAI Whisper, Deepgram Nova-2, Groq Whisper Large, Anthropic Claude, DeepSeek, or run completely private with local Ollama.
              </p>
            </div>

            {/* Card 3 */}
            <div className="card p-6 surface hover:border-primary/40 transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                <Cloud size={20} />
              </div>
              <h3 className="font-semibold text-base mb-2">Cloudflare D1 & R2 Sync</h3>
              <p className="text-sm text-muted leading-relaxed">
                Opt-in anytime to sync your audio library across all devices. Backed by Cloudflare's serverless edge database and high-performance object storage.
              </p>
            </div>

            {/* Card 4 */}
            <div className="card p-6 surface hover:border-primary/40 transition">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                <Shield size={20} />
              </div>
              <h3 className="font-semibold text-base mb-2">ZeptoMail Verified Auth</h3>
              <p className="text-sm text-muted leading-relaxed">
                Enterprise-grade transactional email verification, OTP login, and secure password recovery dispatched instantly via Zoho's ZeptoMail REST API.
              </p>
            </div>

            {/* Card 5 */}
            <div className="card p-6 surface hover:border-primary/40 transition">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
                <MessageSquare size={20} />
              </div>
              <h3 className="font-semibold text-base mb-2">Grounded Audio Chat</h3>
              <p className="text-sm text-muted leading-relaxed">
                Ask questions and receive answers cited directly from specific timestamps. Jump immediately to the exact second where an idea was discussed.
              </p>
            </div>

            {/* Card 6 */}
            <div className="card p-6 surface hover:border-primary/40 transition">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center mb-4">
                <FileText size={20} />
              </div>
              <h3 className="font-semibold text-base mb-2">Automated Structured Docs</h3>
              <p className="text-sm text-muted leading-relaxed">
                Convert messy transcripts into Executive Briefs, Meeting Action Items, Study Guides, and Blog Posts with one click, then export as Markdown or JSON.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. COMPARISON SECTION: LOCAL VS CLOUD */}
      <section id="sync-architecture" className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold">Local-First or Cloud Connected? You Decide.</h2>
            <p className="text-sm text-muted mt-2">
              Sonexa never locks you in. You get full functionality without creating an account, or optional cloud sync when you need cross-device mobility.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Local Card */}
            <div className="card p-7 surface border-app flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full surface-2 text-xs font-semibold text-muted mb-4">
                  <HardDrive size={13} /> Local-First Mode
                </div>
                <h3 className="text-xl font-bold">100% Private & Free</h3>
                <p className="text-xs text-muted mt-2">Works immediately in your browser with zero configuration.</p>
                <div className="mt-6 space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-primary shrink-0" />
                    <span>No sign-up or credit card required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-primary shrink-0" />
                    <span>Audio and transcripts stay on your device</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-primary shrink-0" />
                    <span>Supports local LLMs via Ollama</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-primary shrink-0" />
                    <span>Unlimited recordings & exports</span>
                  </div>
                </div>
              </div>
              <button
                onClick={onLaunchWorkspace}
                className="btn-outline w-full mt-8 !py-2.5 text-xs font-semibold"
              >
                Launch Local Workspace Now
              </button>
            </div>

            {/* Cloud Sync Card */}
            <div className="card p-7 surface border-primary/40 relative overflow-hidden flex flex-col justify-between shadow-soft">
              <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                CLOUD SYNC
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-xs font-semibold text-primary mb-4">
                  <Cloud size={13} /> Multi-Provider Cloud Sync
                </div>
                <h3 className="text-xl font-bold">Your Cloud, Your Rules</h3>
                <p className="text-xs text-muted mt-2">Bring your own Google Drive, OneDrive, Nextcloud/WebDAV, or use Sonexa Cloud.</p>
                <div className="mt-6 space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-primary shrink-0" />
                    <span>Google Drive (15 GB free AppData storage)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-primary shrink-0" />
                    <span>Microsoft OneDrive (AppFolder integration)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-primary shrink-0" />
                    <span>Nextcloud & WebDAV (Self-hosted & private)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-primary shrink-0" />
                    <span>Built-in Sonexa Cloud (Cloudflare edge database)</span>
                  </div>
                </div>
              </div>
              <button
                onClick={onOpenCloudSync || onLaunchWorkspace}
                className="btn-primary w-full mt-8 !py-2.5 text-xs font-semibold shadow-soft flex items-center justify-center gap-2"
              >
                <Cloud size={14} />
                <span>Connect Cloud Storage Provider</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CALL TO ACTION BANNER */}
      <section className="py-16 surface-2 border-t border-app">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold">Ready to Transcribe and Master Your Audio?</h2>
          <p className="mt-3 text-sm text-muted">
            Start a new session right now without signing up, or create an account for Cloudflare synchronization.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={onLaunchWorkspace}
              className="btn-primary !py-3 !px-6 text-sm font-semibold rounded-xl shadow-soft"
            >
              Start Recording for Free
            </button>
            <button
              onClick={onOpenCloudSync || onLaunchWorkspace}
              className="btn-ghost !py-3 !px-5 text-sm font-semibold flex items-center gap-1.5"
            >
              <Cloud size={16} className="text-primary" />
              <span>Choose Cloud Storage Provider</span>
            </button>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="mt-auto surface border-t border-app py-8 text-xs text-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AudioWaveform size={15} className="text-primary" />
            <span className="font-semibold text-[var(--text)]">Sonexa Audio Workspace</span>
            <span className="text-soft">· Local-first & Cloudflare Synced</span>
          </div>
          <div className="flex items-center gap-5 text-soft">
            <a
              href="https://github.com/drhimam/sonexa-audio-workspace"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--text)] transition"
            >
              GitHub Repository
            </a>
            <span>·</span>
            <span>ZeptoMail Transactional Engine</span>
            <span>·</span>
            <span>Cloudflare Edge Stack</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
