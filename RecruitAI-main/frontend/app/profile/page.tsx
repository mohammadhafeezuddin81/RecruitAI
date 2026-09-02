"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { User, Mail, Linkedin, Save, ArrowLeft, Loader2 } from "lucide-react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>({ name: "", email: "", linkedin: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch Profile from DB (via Dashboard logic)
  useEffect(() => {
    axios.get(`${backendUrl}/dashboard`)
      .then(res => {
          if(res.data?.profile) setProfile(res.data.profile);
          setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // We re-use the process-context endpoint concept or a new one, 
    // but since we don't have a dedicated profile-update endpoint in main.py yet,
    // we will just mock the save or you can add a simple endpoint.
    // For now, let's just simulate saving locally or add the endpoint.
    setTimeout(() => {
        setSaving(false);
        alert("Profile Updated (Simulation)");
    }, 1000);
  };

  if (loading) return <div className="min-h-screen bg-slate-950 text-white p-10">Loading...</div>;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">
      <div className="max-w-xl w-full space-y-6">
        <div className="flex items-center gap-4 mb-8">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-full"><ArrowLeft className="w-6 h-6" /></button>
            <h1 className="text-3xl font-bold text-white">My Profile</h1>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm text-slate-400 flex items-center gap-2"><User className="w-4 h-4" /> Full Name</label>
                <input type="text" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 focus:border-blue-500 outline-none" />
            </div>
            <div className="space-y-2">
                <label className="text-sm text-slate-400 flex items-center gap-2"><Mail className="w-4 h-4" /> Email</label>
                <input type="email" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 focus:border-blue-500 outline-none" />
            </div>
            <div className="space-y-2">
                <label className="text-sm text-slate-400 flex items-center gap-2"><Linkedin className="w-4 h-4" /> LinkedIn URL</label>
                <input type="text" value={profile.linkedin} onChange={e => setProfile({...profile, linkedin: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 focus:border-blue-500 outline-none" />
            </div>

            <button type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors">
                {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />} Save Changes
            </button>
        </form>
      </div>
    </main>
  );
}