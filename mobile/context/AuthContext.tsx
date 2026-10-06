import React, { createContext, useContext, useEffect, useState } from 'react';
import { AUTH_NOTICE_MESSAGES, type AuthState } from '../lib/auth/authSessionManager';
import { authSession } from '../lib/auth/authRuntime';

interface AuthContextType extends AuthState {
  /** User-facing message for the latest notice, if any. */
  noticeMessage: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearNotice: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Thin view over AuthSessionManager; restores the secure session on cold start. */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(() => authSession.getState());
  useEffect(() => {
    const unsubscribe = authSession.subscribe(setState);
    if (authSession.getState().status === 'restoring') void authSession.restore().catch(() => {});
    return unsubscribe;
  }, []);
  const value: AuthContextType = {
    ...state,
    noticeMessage: state.notice ? AUTH_NOTICE_MESSAGES[state.notice] : null,
    signInWithGoogle: async () => { await authSession.signInWithGoogle(); },
    signOut: () => authSession.signOut(),
    clearNotice: () => authSession.clearNotice(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
