"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser, SignInButton } from "@clerk/nextjs";
import { LayoutDashboard, Mic, User } from "lucide-react";

export default function Navbar() {
  const { isSignedIn } = useUser();
  const pathname = usePathname();

  const navLink = (href: string, icon: React.ReactNode, label: string) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
          active
            ? "text-white bg-slate-800"
            : "text-slate-400 hover:text-white hover:bg-slate-800/50"
        }`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <nav className="w-full border-b border-slate-800 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-linear-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow-lg group-hover:scale-105 transition-transform">
            R
          </div>
          <span className="text-xl font-bold text-white tracking-tight">
            RecruitAI
          </span>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {isSignedIn ? (
            <>
              {navLink("/", <Mic className="w-4 h-4" />, "Practice")}
              {navLink("/dashboard", <LayoutDashboard className="w-4 h-4" />, "Dashboard")}
              {navLink("/profile", <User className="w-4 h-4" />, "Profile")}
              <div className="ml-3 pl-3 border-l border-slate-700">
                <UserButton afterSignOutUrl="/" />
              </div>
            </>
          ) : (
            <SignInButton mode="modal">
              <button className="text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors border border-slate-700">
                Sign In
              </button>
            </SignInButton>
          )}
        </div>
      </div>
    </nav>
  );
}