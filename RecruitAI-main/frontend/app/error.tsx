"use client";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log to console; swap for Sentry/LogRocket in production
    console.error("[RecruitAI] Unhandled error:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center relative overflow-hidden px-6">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 text-center max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-red-950/50 border border-red-800/50 mb-8 mx-auto shadow-xl">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>

        {/* Logo badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-400 mb-6">
          <div className="w-4 h-4 bg-linear-to-br from-blue-500 to-emerald-500 rounded flex items-center justify-center font-bold text-white text-[10px]">
            R
          </div>
          RecruitAI
        </div>

        <h1 className="text-3xl font-bold text-white mb-3">
          Something went wrong
        </h1>
        <p className="text-slate-400 text-sm mb-3 leading-relaxed">
          An unexpected error occurred. You can try again or return home.
        </p>

        {/* Error details (dev-friendly, collapsible) */}
        {error?.message && (
          <details className="mb-8 text-left bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-500 font-mono cursor-pointer">
            <summary className="text-slate-400 font-sans font-medium text-sm cursor-pointer mb-2">
              Error details
            </summary>
            <p className="break-all leading-relaxed">{error.message}</p>
            {error.digest && (
              <p className="mt-2 text-slate-600">Digest: {error.digest}</p>
            )}
          </details>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:scale-105 active:scale-95 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-all text-sm border border-slate-700"
          >
            <Home className="w-4 h-4" />
            Go Home
          </a>
        </div>
      </div>
    </main>
  );
}
