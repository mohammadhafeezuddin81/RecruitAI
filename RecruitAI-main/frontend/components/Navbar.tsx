"use client";
import Link from "next/link";
import { UserButton, useUser, SignInButton } from "@clerk/nextjs"; // <--- IMPORT
import { LayoutDashboard, Mic } from "lucide-react";

export default function Navbar() {
  const { isSignedIn } = useUser();

  return (
    <nav className="w-full border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center font-bold text-white">A</div>
            <span className="text-xl font-bold text-white">Antriview</span>
        </div>

        <div className="flex items-center gap-4">
            {isSignedIn ? (
                <>
                    <Link href="/" className="text-slate-400 hover:text-white flex gap-2 text-sm"><Mic className="w-4 h-4"/> Practice</Link>
                    <Link href="/dashboard" className="text-slate-400 hover:text-white flex gap-2 text-sm"><LayoutDashboard className="w-4 h-4"/> Dashboard</Link>
                    <div className="ml-4 border-l border-slate-700 pl-4">
                        <UserButton afterSignOutUrl="/"/>
                    </div>
                </>
            ) : (
                <SignInButton mode="modal">
                    <button className="text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors">
                        Sign In
                    </button>
                </SignInButton>
            )}
        </div>
      </div>
    </nav>
  );
}