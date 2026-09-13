"use client";
import Link from "next/link";
import { Home, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center relative overflow-hidden px-6">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 text-center max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-900 border border-slate-800 mb-8 mx-auto shadow-xl">
          <SearchX className="w-10 h-10 text-blue-400" />
        </div>

        {/* Logo badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-400 mb-6">
          <div className="w-4 h-4 bg-linear-to-br from-blue-500 to-emerald-500 rounded flex items-center justify-center font-bold text-white text-[10px]">
            R
          </div>
          RecruitAI
        </div>

        <h1 className="text-6xl font-bold mb-4 bg-linear-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          404
        </h1>
        <h2 className="text-2xl font-bold text-white mb-3">Page Not Found</h2>
        <p className="text-slate-400 text-sm mb-10 leading-relaxed">
          The page you are looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-blue-500/20 hover:scale-105 active:scale-95"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </main>
  );
}
