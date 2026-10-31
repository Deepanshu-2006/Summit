"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalMode: "signin" | "signup";
  redirectTo: string | null;
  openAuthModal: (options?: {
    mode?: "signin" | "signup";
    redirectTo?: string;
  }) => void;
  closeAuthModal: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"signin" | "signup">("signin");
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Fetch initial session & subscribe to auth state changes
  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to retrieve Supabase session:", err);
        if (mounted) setIsLoading(false);
      }
    }

    getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const openAuthModal = useCallback(
    (options?: { mode?: "signin" | "signup"; redirectTo?: string }) => {
      if (options?.mode) setAuthModalMode(options.mode);
      if (options?.redirectTo) setRedirectTo(options.redirectTo);
      else setRedirectTo(null);
      setIsAuthModalOpen(true);
    },
    []
  );

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  }, [supabase]);

  const value = useMemo(
    () => ({
      user,
      session,
      isLoading,
      isAuthModalOpen,
      authModalMode,
      redirectTo,
      openAuthModal,
      closeAuthModal,
      signOut,
    }),
    [
      user,
      session,
      isLoading,
      isAuthModalOpen,
      authModalMode,
      redirectTo,
      openAuthModal,
      closeAuthModal,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

