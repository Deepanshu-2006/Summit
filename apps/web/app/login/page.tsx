"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { SummitLogo } from "@/components/layout/navbar";
import { useAuth } from "@/components/auth/auth-context";
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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();
  const nextUrl = searchParams.get("next") || "/dashboard/project/new";

  // Redirect if already authenticated
  useEffect(() => {
    if (!isAuthLoading && user) {
      router.replace(nextUrl);
    }
  }, [user, isAuthLoading, router, nextUrl]);

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

        router.push(nextUrl);
      } else {
        const { error: signUpError, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo:
              typeof window !== "undefined"
                ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`
                : undefined,
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          setIsSubmitting(false);
          return;
        }

        if (data.session) {
          router.push(nextUrl);
        } else {
          setSuccessMsg(
            "Account created! Please check your email to verify your address."
          );
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthGitHub = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
          skipBrowserRedirect: true,
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setIsSubmitting(false);
        return;
      }

      if (data?.url) {
        // Pre-check if GitHub provider is enabled in the Supabase project
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
          // If fetch throws due to CORS on redirect to github.com, proceed with navigation
        }

        window.location.href = data.url;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to initiate GitHub sign-in.";
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full max-w-[400px] bg-[#141413] border border-[#262624] rounded-[12px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-7 z-10">
      {/* Brand */}
      <div className="flex items-center justify-center gap-2.5 mb-6">
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <SummitLogo className="w-5 h-5 text-accent-orange" />
          <span className="font-sans text-[18px] font-semibold tracking-[-0.02em] text-[#FAF8F5]">
            Summit
          </span>
        </Link>
      </div>

      {/* Tab Toggle */}
      <div className="flex p-0.5 rounded-[8px] bg-[#0E0E0D] border border-[#222220] mb-5">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setError(null);
            setSuccessMsg(null);
          }}
          className={`flex-1 py-1.5 rounded-[6px] text-[13px] font-sans font-medium transition-all ${
            mode === "signin"
              ? "bg-[#20201D] text-[#FAF8F5] shadow-sm"
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
            setSuccessMsg(null);
          }}
          className={`flex-1 py-1.5 rounded-[6px] text-[13px] font-sans font-medium transition-all ${
            mode === "signup"
              ? "bg-[#20201D] text-[#FAF8F5] shadow-sm"
              : "text-[#8E8C86] hover:text-[#FAF8F5]"
          }`}
        >
          Create Account
        </button>
      </div>

      {/* Error Notification */}
      {error && (
        <div className="mb-4 p-3 rounded-[6px] bg-[#2E1816] border border-[#52231F] flex items-start gap-2.5 text-[#F28B82] text-[12px] font-sans">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#F28B82]" />
          <span className="leading-snug">{error}</span>
        </div>
      )}

      {/* Success Notification */}
      {successMsg && (
        <div className="mb-4 p-3 rounded-[6px] bg-[#142A1D] border border-[#1E4D2B] flex items-start gap-2.5 text-[#81C995] text-[12px] font-sans">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#81C995]" />
          <span className="leading-snug">{successMsg}</span>
        </div>
      )}

      {/* GitHub OAuth Button */}
      <button
        type="button"
        onClick={handleOAuthGitHub}
        disabled={isSubmitting}
        className="w-full h-10 rounded-[8px] bg-[#1B1B19] hover:bg-[#232320] border border-[#2B2B28] text-[#FAF8F5] text-[13px] font-medium flex items-center justify-center gap-2.5 transition-colors mb-4 disabled:opacity-50"
      >
        <GitHubIcon className="w-4 h-4" />
        <span>Continue with GitHub</span>
      </button>

      <div className="relative flex items-center justify-center my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#222220]" />
        </div>
        <span className="relative px-3 bg-[#141413] text-[11px] font-mono text-[#8E8C86] uppercase tracking-wider">
          or
        </span>
      </div>

      {/* Credentials Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-[11px] font-mono text-[#A8A6A1] uppercase tracking-wider mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
            className="w-full h-10 px-3 rounded-[8px] bg-[#0E0E0D] border border-[#262624] focus:border-accent-orange text-[#FAF8F5] text-[13px] font-mono outline-none transition-colors placeholder:text-[#5E5D59]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono text-[#A8A6A1] uppercase tracking-wider mb-1.5">
            Password
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full h-10 px-3 rounded-[8px] bg-[#0E0E0D] border border-[#262624] focus:border-accent-orange text-[#FAF8F5] text-[13px] font-mono outline-none transition-colors placeholder:text-[#5E5D59]"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-10 rounded-[8px] bg-accent-orange hover:bg-accent-orange-hover active:translate-y-px text-[#121110] text-[13px] font-medium flex items-center justify-center gap-2 transition-all mt-4 disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#121110]" />
              <span>Processing...</span>
            </>
          ) : mode === "signin" ? (
            <span>Sign In</span>
          ) : (
            <span>Create Account</span>
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-[11px] font-mono text-[#8E8C86]">
        By continuing, you agree to Summit’s{" "}
        <Link href="/terms" className="underline hover:text-[#FAF8F5]">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-[#FAF8F5]">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-[#0C0B0A] flex flex-col items-center justify-center p-4 relative">
      {/* Background Grid Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.25]"
        style={{
          backgroundImage: `radial-gradient(circle, #333230 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />
      <Suspense
        fallback={
          <div className="w-full max-w-[400px] h-[450px] bg-[#141413] border border-[#262624] rounded-[12px] flex items-center justify-center text-[#8E8C86] font-mono text-[13px]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}

