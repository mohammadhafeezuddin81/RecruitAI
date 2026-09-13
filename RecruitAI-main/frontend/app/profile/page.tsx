"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { User, Mail, Linkedin, Save, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { apiClient } from "../../lib/apiClient";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<{ name: string; email: string; linkedin: string }>({
    name: "",
    email: "",
    linkedin: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setLoading(true);
      getToken()
        .then((token) => {
          apiClient.setToken(token);
          return apiClient.getProfile(user.id);
        })
        .then((data) => {
          setProfile({
            name: data?.name || user.fullName || "",
            email: data?.email || user.primaryEmailAddress?.emailAddress || "",
            linkedin: data?.linkedin || "",
          });
          setLoading(false);
        })
        .catch((err) => {
          console.warn("Could not fetch remote profile, seeding with Clerk info:", err);
          setProfile({
            name: user.fullName || "",
            email: user.primaryEmailAddress?.emailAddress || "",
            linkedin: "",
          });
          setLoading(false);
        });
    }
  }, [user, getToken]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSavedSuccess(false);
    setErrorMessage(null);

    try {
      const token = await getToken();
      apiClient.setToken(token);

      await apiClient.updateProfile(user.id, profile);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      console.error("Profile update error:", err);
      setErrorMessage(err?.response?.data?.detail || "Failed to persist profile changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-10 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-slate-400 text-sm">Loading profile data...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">
      <div className="max-w-xl w-full space-y-6 animate-in fade-in duration-300">
        
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.back()}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors border border-slate-800 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Candidate Profile</h1>
            <p className="text-xs text-slate-400">Manage your identity and professional portfolio details</p>
          </div>
        </div>

        {savedSuccess && (
          <div className="bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2.5 shadow-lg animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Profile successfully updated and saved.</span>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-950/60 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2.5 shadow-lg animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5 bg-slate-900/60 border border-slate-800 p-6 md:p-8 rounded-2xl shadow-xl">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-2 uppercase tracking-wider">
              <User className="w-4 h-4 text-blue-400" /> Full Name
            </label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-white focus:border-blue-500 outline-none transition-colors"
              placeholder="e.g. Alex Johnson"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-2 uppercase tracking-wider">
              <Mail className="w-4 h-4 text-purple-400" /> Email Address
            </label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-white focus:border-blue-500 outline-none transition-colors"
              placeholder="e.g. alex@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-2 uppercase tracking-wider">
              <Linkedin className="w-4 h-4 text-emerald-400" /> LinkedIn Profile URL
            </label>
            <input
              type="text"
              value={profile.linkedin}
              onChange={(e) => setProfile({ ...profile, linkedin: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-white focus:border-blue-500 outline-none transition-colors"
              placeholder="https://linkedin.com/in/username"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.99] mt-6"
          >
            {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
            {saving ? "Saving Changes..." : "Save Profile"}
          </button>
        </form>
      </div>
    </main>
  );
}