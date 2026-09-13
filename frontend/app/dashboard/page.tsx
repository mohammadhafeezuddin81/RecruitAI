"use client";
import { useEffect, useState } from "react";
import { useUser, useAuth } from "@clerk/nextjs"; 
import { Home, Briefcase, TrendingUp, Activity, Eye, X, Trophy, Mic, FileText, User as UserIcon, MessageSquare, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiClient } from "../../lib/apiClient";

export default function Dashboard() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<any>(null);

  useEffect(() => {
    if (user) {
      setLoading(true);
      getToken()
        .then((token) => {
          apiClient.setToken(token);
          return apiClient.getDashboard(user.id);
        })
        .then((res) => {
          setData(res);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Dashboard load error:", err);
          setLoading(false);
        });
    }
  }, [user, getToken]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-10 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-400">Please sign in to view your interview history.</p>
        <button onClick={() => router.push("/")} className="text-blue-400 underline">Return to Home</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-10 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-slate-400 text-sm">Loading your candidate analytics...</p>
      </div>
    );
  }

  if (!data || data.status === "empty" || !data.history || data.history.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-10 flex flex-col items-center justify-center gap-6">
        <div className="p-4 bg-blue-900/20 rounded-full">
          <Briefcase className="w-10 h-10 text-blue-400" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">No Past Interviews Found</h2>
          <p className="text-slate-400 max-w-sm">Complete your first mock interview to view comprehensive LangGraph performance metrics.</p>
        </div>
        <button onClick={() => router.push("/")} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white transition-colors">
          Start Your First Interview
        </button>
      </div>
    );
  }

  // Helper for Score Cards inside Modal
  const ScoreCard = ({ title, icon: Icon, score, text }: any) => {
    const rawScore = Number(score) || 0;
    const score10 = rawScore <= 10 ? rawScore.toFixed(1) : (rawScore / 10).toFixed(1);
    const score100 = rawScore > 10 ? Math.round(rawScore) : Math.round(rawScore * 10);

    return (
      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/80">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
            <Icon className="w-4 h-4 text-blue-400" /> {title}
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-white">{score100}<span className="text-xs text-slate-400">/100</span></span>
            <span className="text-[11px] text-slate-400 block">({score10}/10)</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{text || "Evaluated by agent rubric."}</p>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 relative">
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-3xl font-bold">{user.fullName || "Candidate"}&apos;s Dashboard</h1>
                <p className="text-slate-400 text-sm">{user.primaryEmailAddress?.emailAddress}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => router.push("/profile")} className="bg-slate-800 hover:bg-slate-700 px-4 py-2.5 rounded-lg text-slate-200 text-sm font-medium transition-colors border border-slate-700">
                  My Profile
              </button>
              <button onClick={() => router.push("/")} className="bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-lg text-white font-bold text-sm transition-colors shadow-md">
                  Start New Interview
              </button>
            </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 mb-2 text-sm"><Briefcase className="w-4 h-4 text-blue-400" /> Total Sessions</div>
                <div className="text-4xl font-black text-white">{data.total_interviews ?? data.total_sessions}</div>
             </div>
             <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 mb-2 text-sm"><TrendingUp className="w-4 h-4 text-emerald-400" /> Average Score</div>
                <div className="text-4xl font-black text-emerald-400">
                  {data.average_score <= 10 ? `${(data.average_score * 10).toFixed(0)}/100` : `${data.average_score}/100`}
                  <span className="text-xs text-slate-400 font-normal ml-2">({data.average_score <= 10 ? data.average_score : (data.average_score / 10).toFixed(1)}/10)</span>
                </div>
             </div>
             <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 mb-2 text-sm"><Activity className="w-4 h-4 text-orange-400" /> Key Growth Focus</div>
                <div className="text-sm text-orange-300 line-clamp-2">{data.recent_improvements?.[0] || "Continue mock practice for consistent results."}</div>
             </div>
        </div>

        {/* HISTORY TABLE */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white">Session History</h3>
              <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Evaluated Sessions</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950 uppercase text-[11px] text-slate-500 tracking-wider">
                        <tr>
                          <th className="p-4">Date</th>
                          <th className="p-4">Target Role</th>
                          <th className="p-4">Score</th>
                          <th className="p-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {data.history.map((s: any, i: number) => {
                          const displayScore = s.overall_score_100 ?? (s.overall_score > 10 ? s.overall_score : s.overall_score * 10);
                          const isStrong = displayScore >= 70;

                          return (
                            <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                                <td className="p-4 text-xs font-mono">{s.date}</td>
                                <td className="p-4 text-white font-semibold max-w-xs truncate">{s.role}</td>
                                <td className="p-4">
                                  <span className={`font-bold px-2.5 py-1 rounded-md text-xs ${isStrong ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : "bg-yellow-950 text-yellow-300 border border-yellow-800"}`}>
                                    {displayScore}/100
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                    <button 
                                        onClick={() => setSelectedSession(s)}
                                        className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 bg-blue-900/30 hover:bg-blue-900/50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-blue-800/50"
                                    >
                                        <Eye className="w-3.5 h-3.5" /> Details
                                    </button>
                                </td>
                            </tr>
                          );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      {/* --- SESSION DETAILS MODAL --- */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <div>
                        <h2 className="text-xl font-bold text-white">{selectedSession.role}</h2>
                        <p className="text-slate-400 text-xs mt-1">
                          {selectedSession.date} • Overall Performance:{" "}
                          <span className="text-emerald-400 font-bold">
                            {selectedSession.overall_score_100 ?? (selectedSession.overall_score > 10 ? selectedSession.overall_score : selectedSession.overall_score * 10)}/100
                          </span>
                        </p>
                    </div>
                    <button onClick={() => setSelectedSession(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {/* 1. Feedback Section */}
                    <section>
                        <h3 className="text-sm font-bold mb-3 uppercase tracking-wider text-slate-400 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-blue-400" /> Rubric Evaluation
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ScoreCard title="Technical Depth" icon={Trophy} score={selectedSession.scores?.technical} text={selectedSession.feedback_text?.technical?.feedback} />
                            <ScoreCard title="Communication" icon={Mic} score={selectedSession.scores?.communication} text={selectedSession.feedback_text?.communication?.feedback} />
                            <ScoreCard title="Problem Solving" icon={FileText} score={selectedSession.scores?.resume} text={selectedSession.feedback_text?.resume_fit?.feedback} />
                            <ScoreCard title="Composure & Flow" icon={UserIcon} score={selectedSession.scores?.presentation} text={selectedSession.feedback_text?.presentation?.feedback} />
                        </div>
                    </section>

                    {/* 2. Transcript Section */}
                    <section>
                        <h3 className="text-sm font-bold mb-3 uppercase tracking-wider text-slate-400 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-orange-400" /> Conversation Transcript
                        </h3>
                        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-4 max-h-[360px] overflow-y-auto custom-scrollbar">
                            {selectedSession.transcript && selectedSession.transcript.length > 0 ? (
                                selectedSession.transcript.map((msg: any, idx: number) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' || msg.role === 'candidate' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                                            msg.role === 'user' || msg.role === 'candidate' 
                                            ? 'bg-blue-600 text-white rounded-tr-sm' 
                                            : 'bg-slate-800 text-slate-300 rounded-tl-sm border border-slate-700'
                                        }`}>
                                            <span className="text-[10px] opacity-60 block mb-1 uppercase font-bold tracking-wider">
                                              {msg.role === 'user' || msg.role === 'candidate' ? 'Candidate' : 'Alex (Interviewer)'}
                                            </span>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 text-xs italic text-center py-6">Transcript not recorded for this session.</p>
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