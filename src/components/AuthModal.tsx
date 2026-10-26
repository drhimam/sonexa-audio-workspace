import { useState, useEffect } from 'react';
import {
  Mail, Lock, User as UserIcon, ArrowRight, ArrowLeft,
  CheckCircle2, AlertCircle, Loader2, ShieldCheck,
  Cloud, RefreshCw, KeyRound, Sparkles,
} from 'lucide-react';
import { Modal } from './Modal';
import type { useAuth } from '@/lib/useAuth';

export type AuthMode = 'signin' | 'signup' | 'verify' | 'forgot' | 'reset';

interface AuthModalProps {
  open: boolean;
  initialMode?: AuthMode;
  onClose: () => void;
  auth: ReturnType<typeof useAuth>;
  onSuccess?: () => void;
}

export function AuthModal({
  open,
  initialMode = 'signin',
  onClose,
  auth,
  onSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
    setSuccessMsg(null);
  }, [initialMode, open]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await auth.signUp(name.trim(), email.trim().toLowerCase(), password);
      setSuccessMsg(res.message);
      setMode('verify');
      setResendCooldown(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await auth.verifyEmail(email.trim().toLowerCase(), otpCode.trim());
      setSuccessMsg('Account verified successfully! Cloud sync enabled.');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;
    setLoading(true);
    setError(null);
    try {
      const res = await auth.resendVerification(email.trim().toLowerCase());
      setSuccessMsg(res.message);
      setResendCooldown(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await auth.signIn(email.trim().toLowerCase(), password);
      setSuccessMsg('Signed in successfully!');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 600);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Sign in failed';
      if (errMsg.toLowerCase().includes('verify')) {
        setMode('verify');
        setResendCooldown(30);
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await auth.forgotPassword(email.trim().toLowerCase());
      setSuccessMsg(res.message);
      setMode('reset');
      setResendCooldown(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await auth.resetPassword(email.trim().toLowerCase(), otpCode.trim(), password);
      setSuccessMsg(res.message);
      setTimeout(() => {
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
        setOtpCode('');
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<AuthMode, { title: string; subtitle: string; icon: React.ReactNode }> = {
    signin: {
      title: 'Welcome Back',
      subtitle: 'Sign in to access your cloud-synchronized workspace',
      icon: <Cloud className="text-primary" size={20} />,
    },
    signup: {
      title: 'Create Your Account',
      subtitle: 'Unlock multi-device sync, Cloudflare backup, and team export',
      icon: <Sparkles className="text-primary" size={20} />,
    },
    verify: {
      title: 'Verify Your Email',
      subtitle: `We sent a 6-digit code via ZeptoMail to ${email || 'your email'}`,
      icon: <ShieldCheck className="text-primary" size={20} />,
    },
    forgot: {
      title: 'Reset Password',
      subtitle: 'Enter your email to receive password reset instructions',
      icon: <KeyRound className="text-primary" size={20} />,
    },
    reset: {
      title: 'Set New Password',
      subtitle: 'Enter the code from ZeptoMail and choose a secure password',
      icon: <Lock className="text-primary" size={20} />,
    },
  };

  const currentMeta = titles[mode];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={currentMeta.title}
      subtitle={currentMeta.subtitle}
      icon={currentMeta.icon}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 pt-1">
        {/* Status Alerts */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs animate-slide-up">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {successMsg && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs animate-slide-up">
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
            <div className="flex-1">{successMsg}</div>
          </div>
        )}

        {/* 1. SIGN IN VIEW */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-3.5">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Email address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-soft" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input !pl-9 text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-muted">Password</label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null); }}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-soft" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input !pl-9 text-sm"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              <span>Sign In to Sync</span>
            </button>

            <div className="text-center pt-2">
              <span className="text-xs text-muted">Don't have an account? </span>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(null); }}
                className="text-xs text-primary font-medium hover:underline"
              >
                Sign up free
              </button>
            </div>
          </form>
        )}

        {/* 2. SIGN UP VIEW */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Full name</label>
              <div className="relative">
                <UserIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-soft" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="input !pl-9 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted block mb-1">Email address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-soft" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input !pl-9 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted block mb-1">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-soft" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="input !pl-9 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted block mb-1">Confirm password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-soft" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="input !pl-9 text-sm"
                />
              </div>
            </div>

            <p className="text-[11px] text-soft leading-tight">
              By creating an account, you agree to local data preservation and optional Cloudflare cloud synchronization. Emails are securely sent via ZeptoMail.
            </p>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              <span>Create Account</span>
            </button>

            <div className="text-center pt-1">
              <span className="text-xs text-muted">Already have an account? </span>
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null); }}
                className="text-xs text-primary font-medium hover:underline"
              >
                Sign in
              </button>
            </div>
          </form>
        )}

        {/* 3. VERIFY EMAIL VIEW */}
        {mode === 'verify' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="p-3 surface-2 rounded-lg text-xs text-muted space-y-1">
              <p>Check your inbox for a 6-digit confirmation code sent by <span className="font-semibold text-[var(--text)]">ZeptoMail</span>.</p>
              <p className="text-soft text-[11px]">Didn't get it? Check your spam folder or click resend below.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted block mb-1 text-center">Enter 6-Digit Code</label>
              <input
                type="text"
                maxLength={6}
                autoFocus
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="input text-center text-2xl tracking-[0.35em] font-mono py-2.5 font-bold text-primary"
              />
            </div>

            <button type="submit" disabled={loading || otpCode.length < 6} className="btn-primary w-full">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              <span>Verify & Activate Account</span>
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="btn-ghost !px-2 text-soft"
              >
                <ArrowLeft size={13} /> Change email
              </button>

              <button
                type="button"
                disabled={resendCooldown > 0 || loading}
                onClick={handleResend}
                className="text-primary hover:underline disabled:text-soft disabled:no-underline flex items-center gap-1"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code via ZeptoMail'}
              </button>
            </div>
          </form>
        )}

        {/* 4. FORGOT PASSWORD VIEW */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-3.5">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Registered email address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-soft" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input !pl-9 text-sm"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              <span>Send Reset Code via ZeptoMail</span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null); }}
                className="text-xs text-muted hover:text-[var(--text)] inline-flex items-center gap-1.5"
              >
                <ArrowLeft size={13} /> Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* 5. RESET PASSWORD VIEW */}
        {mode === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Verification Code</label>
              <input
                type="text"
                maxLength={6}
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                className="input text-center text-lg tracking-[0.25em] font-mono py-1.5"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted block mb-1">New Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="input text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted block mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="input text-sm"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              <span>Update Password</span>
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null); }}
                className="text-xs text-muted hover:text-[var(--text)] inline-flex items-center gap-1"
              >
                <ArrowLeft size={13} /> Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* Security & ZeptoMail branding footer */}
        <div className="pt-3 border-t border-app flex items-center justify-between text-[11px] text-soft">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-primary" />
            <span>Encrypted credentials</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Powered by</span>
            <span className="font-semibold text-muted">ZeptoMail</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
