"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
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
  const syncedProfileUsers = useRef(new Set<string>());
  const syncingProfileUsers = useRef(new Set<string>());

  const supabase = useMemo(() => createClient(), []);

  const syncProfile = useCallback((currentSession: Session) => {
    const userId = currentSession.user.id;
    if (
      syncedProfileUsers.current.has(userId) ||
      syncingProfileUsers.current.has(userId)
    ) {
      return;
    }

    syncingProfileUsers.current.add(userId);
    // Defer the request until the Supabase auth event callback has returned.
    window.setTimeout(() => {
      const syncWithRetry = async () => {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const response = await fetch("/api/auth/profile-sync", {
              method: "POST",
              headers: { Authorization: `Bearer ${currentSession.access_token}` },
              cache: "no-store",
            });

            if (!response.ok) {
              const error = new Error(
                `Profile sync returned HTTP ${response.status}`,
              );
              if (response.status < 500 && response.status !== 429) {
                console.error("Failed to sync authenticated user profile", {
                  userId,
                  error,
                });
                return;
              }
              throw error;
            }

            syncedProfileUsers.current.add(userId);
            return;
          } catch (error: unknown) {
            if (attempt === 2) {
              console.error("Failed to sync authenticated user profile", {
                userId,
                error,
              });
              return;
            }

            await new Promise((resolve) =>
              window.setTimeout(resolve, 500 * (attempt + 1)),
            );
          }
        }
      };

      void syncWithRetry().finally(() => {
        syncingProfileUsers.current.delete(userId);
      });
    }, 0);
  }, []);

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
          if (initialSession) syncProfile(initialSession);
        }
      } catch (err) {
        console.error("Failed to retrieve Supabase session:", err);
        if (mounted) setIsLoading(false);
      }
    }

    getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
      if (event === "SIGNED_OUT") {
        syncedProfileUsers.current.clear();
      } else if (
        currentSession &&
        (event === "INITIAL_SESSION" ||
          event === "SIGNED_IN" ||
          event === "USER_UPDATED" ||
          (event === "TOKEN_REFRESHED" &&
            !syncedProfileUsers.current.has(currentSession.user.id)))
      ) {
        if (event === "USER_UPDATED") {
          syncedProfileUsers.current.delete(currentSession.user.id);
        }
        syncProfile(currentSession);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, syncProfile]);

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

