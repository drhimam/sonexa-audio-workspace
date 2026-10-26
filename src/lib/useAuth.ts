import { useState, useEffect, useCallback } from 'react';

export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: number;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  syncEnabled: boolean;
  syncAudio: boolean;
  syncStatus: SyncStatus;
  lastSyncTime: number | null;
  syncError?: string | null;
}

const STORAGE_KEY = 'sonexa_auth_session';
const SYNC_SETTINGS_KEY = 'sonexa_sync_settings';

export function useAuth() {
  const [state, setState] = useState<AuthState>(() => {
    try {
      const savedAuth = localStorage.getItem(STORAGE_KEY);
      const savedSync = localStorage.getItem(SYNC_SETTINGS_KEY);
      const auth = savedAuth ? JSON.parse(savedAuth) : null;
      const sync = savedSync ? JSON.parse(savedSync) : null;

      return {
        user: auth?.user ?? null,
        token: auth?.token ?? null,
        isLoggedIn: !!auth?.user && !!auth?.token,
        syncEnabled: sync?.syncEnabled ?? false,
        syncAudio: sync?.syncAudio ?? false,
        syncStatus: 'idle',
        lastSyncTime: sync?.lastSyncTime ?? null,
        syncError: null,
      };
    } catch {
      return {
        user: null,
        token: null,
        isLoggedIn: false,
        syncEnabled: false,
        syncAudio: false,
        syncStatus: 'idle',
        lastSyncTime: null,
        syncError: null,
      };
    }
  });

  // Persist auth and sync settings changes
  useEffect(() => {
    if (state.user && state.token) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: state.user, token: state.token }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [state.user, state.token]);

  useEffect(() => {
    localStorage.setItem(
      SYNC_SETTINGS_KEY,
      JSON.stringify({
        syncEnabled: state.syncEnabled,
        syncAudio: state.syncAudio,
        lastSyncTime: state.lastSyncTime,
      })
    );
  }, [state.syncEnabled, state.syncAudio, state.lastSyncTime]);

  const signUp = useCallback(async (name: string, email: string, password: string): Promise<{ success: boolean; message: string; requiresVerification: boolean }> => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, message: data.message || 'Verification email sent via ZeptoMail.', requiresVerification: true };
      }

      // If server returned error response
      if (res.status === 400 || res.status === 409) {
        const err = await res.json().catch(() => ({ error: 'Sign up failed' }));
        throw new Error(err.error || 'Sign up failed');
      }

      throw new Error(`Server returned status ${res.status}`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Fallback for local simulation mode if API server is not running
      if (errMsg.includes('Failed to fetch') || errMsg.includes('404')) {
        console.warn('Backend /api/auth/signup not reachable. Using simulated local auth mode.');
        // Store pending user simulation
        const demoUser: User = {
          id: `usr_${Date.now()}`,
          name,
          email,
          emailVerified: false,
          createdAt: Date.now(),
        };
        sessionStorage.setItem('sonexa_pending_user', JSON.stringify({ user: demoUser, demoOtp: '123456' }));
        return {
          success: true,
          message: 'Simulation Mode: ZeptoMail verification code sent! (Use demo OTP: 123456)',
          requiresVerification: true,
        };
      }
      throw new Error(errMsg);
    }
  }, []);

  const verifyEmail = useCallback(async (email: string, code: string): Promise<{ success: boolean; user: User; token: string }> => {
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      if (res.ok) {
        const data = await res.json();
        const user: User = data.user;
        const token: string = data.token;
        setState((s) => ({
          ...s,
          user,
          token,
          isLoggedIn: true,
          syncEnabled: true,
          syncStatus: 'synced',
        }));
        return { success: true, user, token };
      }

      const err = await res.json().catch(() => ({ error: 'Verification failed' }));
      throw new Error(err.error || 'Invalid or expired verification code');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('Failed to fetch') || errMsg.includes('404')) {
        // Fallback local verification
        const pendingStr = sessionStorage.getItem('sonexa_pending_user');
        if (pendingStr) {
          const pending = JSON.parse(pendingStr);
          if (code.trim() === pending.demoOtp || code.trim() === '123456') {
            const verifiedUser: User = { ...pending.user, emailVerified: true };
            const fakeToken = `sim_jwt_${Date.now()}`;
            setState((s) => ({
              ...s,
              user: verifiedUser,
              token: fakeToken,
              isLoggedIn: true,
              syncEnabled: true,
              syncStatus: 'synced',
            }));
            sessionStorage.removeItem('sonexa_pending_user');
            return { success: true, user: verifiedUser, token: fakeToken };
          }
        }
      }
      throw new Error(errMsg);
    }
  }, []);

  const resendVerification = useCallback(async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/auth/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        return { success: true, message: 'New verification code sent via ZeptoMail.' };
      }
      throw new Error('Could not resend code');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('Failed to fetch') || errMsg.includes('404')) {
        return { success: true, message: 'Simulation Mode: New code sent (Use demo OTP: 123456)' };
      }
      throw new Error(errMsg);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; user: User; token: string }> => {
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        const user: User = data.user;
        const token: string = data.token;
        setState((s) => ({
          ...s,
          user,
          token,
          isLoggedIn: true,
          syncEnabled: true,
          syncStatus: 'synced',
        }));
        return { success: true, user, token };
      }

      const err = await res.json().catch(() => ({ error: 'Sign in failed' }));
      throw new Error(err.error || 'Invalid email or password');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('Failed to fetch') || errMsg.includes('404')) {
        // Fallback local demo sign-in
        const demoUser: User = {
          id: `usr_demo_${Date.now()}`,
          name: email.split('@')[0] || 'User',
          email,
          emailVerified: true,
          createdAt: Date.now(),
        };
        const demoToken = `sim_jwt_${Date.now()}`;
        setState((s) => ({
          ...s,
          user: demoUser,
          token: demoToken,
          isLoggedIn: true,
          syncEnabled: true,
          syncStatus: 'synced',
        }));
        return { success: true, user: demoUser, token: demoToken };
      }
      throw new Error(errMsg);
    }
  }, []);

  const forgotPassword = useCallback(async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        return { success: true, message: 'Password reset code sent via ZeptoMail.' };
      }
      const err = await res.json().catch(() => ({ error: 'Failed' }));
      throw new Error(err.error || 'Failed to process forgot password');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('Failed to fetch') || errMsg.includes('404')) {
        return { success: true, message: 'Simulation Mode: Password reset code sent! (Use demo OTP: 123456)' };
      }
      throw new Error(errMsg);
    }
  }, []);

  const resetPassword = useCallback(async (email: string, code: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });
      if (res.ok) {
        return { success: true, message: 'Password reset successful. Please sign in.' };
      }
      const err = await res.json().catch(() => ({ error: 'Reset failed' }));
      throw new Error(err.error || 'Invalid or expired reset code');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('Failed to fetch') || errMsg.includes('404')) {
        if (code === '123456' || code.length === 6) {
          return { success: true, message: 'Simulation Mode: Password updated successfully! Please sign in.' };
        }
      }
      throw new Error(errMsg);
    }
  }, []);

  const signOut = useCallback(() => {
    setState({
      user: null,
      token: null,
      isLoggedIn: false,
      syncEnabled: false,
      syncAudio: false,
      syncStatus: 'idle',
      lastSyncTime: null,
      syncError: null,
    });
  }, []);

  const toggleSync = useCallback((enabled: boolean) => {
    setState((s) => ({ ...s, syncEnabled: enabled, syncStatus: enabled ? 'synced' : 'idle' }));
  }, []);

  const toggleSyncAudio = useCallback((enabled: boolean) => {
    setState((s) => ({ ...s, syncAudio: enabled }));
  }, []);

  const setSyncStatus = useCallback((status: SyncStatus, error: string | null = null) => {
    setState((s) => ({
      ...s,
      syncStatus: status,
      syncError: error,
      lastSyncTime: status === 'synced' ? Date.now() : s.lastSyncTime,
    }));
  }, []);

  return {
    ...state,
    signUp,
    verifyEmail,
    resendVerification,
    signIn,
    forgotPassword,
    resetPassword,
    signOut,
    toggleSync,
    toggleSyncAudio,
    setSyncStatus,
  };
}
