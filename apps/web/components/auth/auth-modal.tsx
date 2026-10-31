"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { SummitLogo } from "@/components/layout/navbar";
import { useAuth } from "./auth-context";
import { createClient } from "@/lib/supabase/client";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function AuthModal() {
  const router = useRouter();
  const { isAuthModalOpen, closeAuthModal, authModalMode, redirectTo } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">(authModalMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    setMode(authModalMode);
    setError(null);
    setSuccessMsg(null);
  }, [authModalMode, isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(signInError.message);
          setIsSubmitting(false);
          return;
        }

        closeAuthModal();
        if (redirectTo) {
          router.push(redirectTo);
        }
      } else {
        const { error: signUpError, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/dashboard/project/new` : undefined,
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          setIsSubmitting(false);
          return;
        }

        if (data.session) {
          // Auto signed in (confirm email disabled)
          closeAuthModal();
          if (redirectTo) {
            router.push(redirectTo);
          }
        } else {
          setSuccessMsg(
            "Account created! Please check your email inbox to verify your address."
          );
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthGitHub = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const destination = redirectTo || "/dashboard/project/new";

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(destination)}`,
          skipBrowserRedirect: true,
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setIsSubmitting(false);
        return;
      }

      if (data?.url) {
        // Pre-check if GitHub provider is actually enabled in the Supabase project
        try {
          const precheck = await fetch(data.url, { method: "GET" });
          if (!precheck.ok) {
            const body = await precheck.json().catch(() => null);
            if (body?.msg?.includes("provider is not enabled")) {
              setError(
                "GitHub provider is not enabled in your Supabase project. Go to your Supabase Dashboard > Authentication > Providers > GitHub, toggle it ON, and add your GitHub OAuth credentials."
              );
              setIsSubmitting(false);
              return;
            }
          }
        } catch {
          // If fetch throws (e.g. CORS on successful redirect to github.com), proceed with redirect
        }

        window.location.href = data.url;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to initiate GitHub sign-in.";
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[3px] animate-in fade-in duration-150"
      onClick={closeAuthModal}
    >
      <div
        className="relative w-full max-w-[390px] bg-[#141413] border border-[#262624] rounded-[12px] shadow-[0_16px_48px_rgba(0,0,0,0.85)] p-6 select-none animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <SummitLogo className="w-4 h-4 text-accent-orange" />
            <span className="font-sans text-[15px] font-semibold tracking-[-0.02em] text-[#FAF8F5]">
              Summit
            </span>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            className="w-6 h-6 rounded flex items-center justify-center text-[#8E8C86] hover:text-[#FAF8F5] transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title */}
        <div className="mt-4">
          <h2 className="font-sans text-[18px] font-semibold text-[#FAF8F5] tracking-[-0.02em]">
            {mode === "signin" ? "Sign in to Summit" : "Create your account"}
          </h2>
          <p className="font-sans text-[12px] text-[#8E8C86] mt-1 leading-relaxed">
            {mode === "signin"
              ? "Access your cloud architectures and workspace."
              : "Start visually building your cloud infrastructure."}
          </p>
        </div>

        {/* Mode Toggle Tabs */}
        <div className="flex items-center bg-[#1A1A18] border border-[#262624] rounded-[8px] p-0.5 mt-4">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className={`w-1/2 py-1.5 rounded-[6px] text-[12px] font-sans font-medium transition-all ${
              mode === "signin"
                ? "bg-[#252523] text-[#FAF8F5] shadow-sm"
                : "text-[#8E8C86] hover:text-[#FAF8F5]"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`w-1/2 py-1.5 rounded-[6px] text-[12px] font-sans font-medium transition-all ${
              mode === "signup"
                ? "bg-[#252523] text-[#FAF8F5] shadow-sm"
                : "text-[#8E8C86] hover:text-[#FAF8F5]"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Alert Notifications */}
        {error && (
          <div className="mt-3.5 p-2.5 rounded-[6px] bg-[#2A1818] border border-[#442222] text-[#E08A8A] text-[11.5px] font-sans flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#E08A8A] mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-3.5 p-2.5 rounded-[6px] bg-[#1A261E] border border-[#264430] text-[#83B69A] text-[11.5px] font-sans flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#83B69A] mt-0.5" />
            <span className="leading-snug">{successMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-[#8E8C86]">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="developer@summit.dev"
              className="w-full bg-[#181817] border border-[#2B2B28] focus:border-accent-orange rounded-[6px] px-3 py-2 text-[12.5px] font-mono text-[#FAF8F5] placeholder-[#555550] outline-none transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-mono text-[#8E8C86]">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#181817] border border-[#2B2B28] focus:border-accent-orange rounded-[6px] px-3 py-2 text-[12.5px] font-mono text-[#FAF8F5] placeholder-[#555550] outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-[6px] bg-accent-orange hover:bg-accent-orange-hover active:translate-y-px text-[#121110] text-[13px] font-medium transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{mode === "signin" ? "Sign In" : "Create Account"}</span>
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#222220]" />
          </div>
          <div className="relative flex justify-center text-[10.5px] font-mono uppercase tracking-wider">
            <span className="bg-[#141413] px-2 text-[#70706C]">or continue with</span>
          </div>
        </div>

        {/* GitHub OAuth Button */}
        <button
          type="button"
          onClick={handleOAuthGitHub}
          className="w-full flex items-center justify-center gap-2.5 py-2 rounded-[6px] bg-[#1A1A18] hover:bg-[#20201E] border border-[#2A2A28] text-[12.5px] font-sans text-[#FAF8F5] transition-colors cursor-pointer"
        >
          <GitHubIcon className="w-4 h-4 text-[#FAF8F5]" />
          <span>Continue with GitHub</span>
        </button>
      </div>
    </div>
  );
}
