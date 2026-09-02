"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { useUser } from "@clerk/nextjs"; 
import { Home, Briefcase, TrendingUp, Activity, Calendar, Eye, X, Trophy, Mic, FileText, User as UserIcon, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000";

export default function Dashboard() {
  const { user } = useUser();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [selectedSession, setSelectedSession] = useState<any>(null); // For Modal

  useEffect(() => {
    if (user) {
        axios.get(`${backendUrl}/dashboard/${user.id}`)
          .then(res => setData(res.data))
          .catch(console.error);
    }
  }, [user]);

  if (!user) return <div className="min-h-screen bg-slate-950 text-white p-10">Please Sign In</div>;
  if (!data) return <div className="min-h-screen bg-slate-950 text-white p-10">Loading...</div>;
  if (data.status === "empty") return <div className="min-h-screen bg-slate-950 text-white p-10">No interviews found.</div>;

  // Helper for Score Cards inside Modal
  const ScoreCard = ({ title, icon: Icon, score, text }: any) => (
    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2 text-slate-300 font-semibold"><Icon className="w-4 h-4" /> {title}</div>
            <span className="text-xl font-bold text-white">{score}/10</span>
        </div>
        <p className="text-xs text-slate-400">{text || "No feedback available."}</p>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 relative">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-3xl font-bold">{user.fullName}'s Dashboard</h1>
                <p className="text-slate-400">{user.primaryEmailAddress?.emailAddress}</p>
            </div>
            <button onClick={() => router.push("/")} className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg text-white font-bold transition-colors">
                Start New Interview
            </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-6">
             <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 mb-2"><Briefcase className="w-4 h-4" /> Total Sessions</div>
                <div className="text-4xl font-bold text-white">{data.total_interviews}</div>
             </div>
             <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 mb-2"><TrendingUp className="w-4 h-4" /> Avg Score</div>
                <div className="text-4xl font-bold text-emerald-400">{data.average_score}</div>
             </div>
             <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 mb-2"><Activity className="w-4 h-4" /> Focus Area</div>
                <div className="text-sm text-orange-300">{data.recent_improvements[0] || "Keep practicing!"}</div>
             </div>
        </div>

        {/* HISTORY TABLE */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-800"><h3 className="font-bold text-lg">Session History</h3></div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950 uppercase text-slate-500">
                        <tr><th className="p-4">Date</th><th className="p-4">Role</th><th className="p-4">Score</th><th className="p-4">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {data.history.map((s: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                                <td className="p-4">{s.date}</td>
                                <td className="p-4 text-white font-bold">{s.role}</td>
                                <td className="p-4"><span className={`font-bold ${s.overall_score >= 7 ? "text-emerald-400" : "text-yellow-400"}`}>{s.overall_score}/10</span></td>
                                <td className="p-4">
                                    <button 
                                        onClick={() => setSelectedSession(s)}
                                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 bg-blue-900/20 px-3 py-1.5 rounded transition-colors"
                                    >
                                        <Eye className="w-4 h-4" /> View Details
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      {/* --- SESSION DETAILS MODAL --- */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{selectedSession.role}</h2>
                        <p className="text-slate-400 text-sm">{selectedSession.date} • Overall Score: <span className="text-emerald-400 font-bold">{selectedSession.overall_score}/10</span></p>
                    </div>
                    <button onClick={() => setSelectedSession(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                </div>

                {/* Modal Content (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    
                    {/* 1. Feedback Section */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-blue-400" /> Feedback Report</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ScoreCard title="Technical" icon={Trophy} score={selectedSession.scores.technical} text={selectedSession.feedback_text.technical?.feedback} />
                            <ScoreCard title="Communication" icon={Mic} score={selectedSession.scores.communication} text={selectedSession.feedback_text.communication?.feedback} />
                            <ScoreCard title="Resume Fit" icon={FileText} score={selectedSession.scores.resume} text={selectedSession.feedback_text.resume_fit?.feedback} />
                            <ScoreCard title="Presentation" icon={UserIcon} score={selectedSession.scores.presentation} text={selectedSession.feedback_text.presentation?.feedback} />
                        </div>
                    </section>

                    {/* 2. Transcript Section */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-orange-400" /> Conversation Transcript</h3>
                        <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {selectedSession.transcript && selectedSession.transcript.length > 0 ? (
                                selectedSession.transcript.map((msg: any, idx: number) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                                            msg.role === 'user' 
                                            ? 'bg-blue-900/30 text-blue-100 border border-blue-800' 
                                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                                        }`}>
                                            <span className="text-xs opacity-50 block mb-1 uppercase font-bold tracking-wider">{msg.role}</span>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 italic text-center">Transcript not available for this session.</p>
                            )}
                        </div>
                    </section>

                </div>
            </div>
        </div>
      )}

    </main>
  );
}