export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-6 px-6">
      {/* Logo pulse */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-emerald-500 rounded-2xl flex items-center justify-center font-bold text-white text-xl shadow-xl shadow-blue-500/20 animate-pulse">
          R
        </div>
        <span className="text-lg font-bold text-white tracking-tight">
          RecruitAI
        </span>
      </div>

      {/* Skeleton content */}
      <div className="w-full max-w-2xl space-y-4">
        {/* Header skeleton */}
        <div className="h-8 bg-slate-800 rounded-xl animate-pulse w-3/5 mx-auto" />
        <div className="h-4 bg-slate-800/70 rounded-lg animate-pulse w-2/5 mx-auto" />

        {/* Card skeleton */}
        <div className="mt-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="h-4 bg-slate-800 rounded animate-pulse w-1/4" />
          <div className="h-20 bg-slate-800/60 rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-12 bg-slate-800/60 rounded-xl animate-pulse" />
            <div className="h-12 bg-slate-800/60 rounded-xl animate-pulse" />
          </div>
          <div className="h-24 bg-slate-800/40 rounded-xl animate-pulse border-2 border-dashed border-slate-700" />
        </div>
      </div>

      {/* Loading indicator */}
      <div className="flex items-center gap-2 text-slate-500 text-xs">
        <svg
          className="animate-spin h-3.5 w-3.5 text-blue-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Loading...
      </div>
    </main>
  );
}
