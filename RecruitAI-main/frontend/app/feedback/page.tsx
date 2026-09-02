"use client";
import { useRouter } from "next/navigation";
import { useInterview } from "../context/InterviewContext";
import { Trophy, Mic, FileText, User, Home, Lightbulb, LayoutDashboard } from "lucide-react";

export default function FeedbackPage() {
  const router = useRouter();
  const { feedback, resetSession } = useInterview();

  const handleStartNew = () => { resetSession(); router.push("/"); };

  if (!feedback) return (
    <div className="min-h-screen bg-slate-950 text-white p-10 flex flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-bold">Loading Report...</h2>
        <p className="text-slate-400">If this takes too long, the session may have been empty.</p>
        <button onClick={handleStartNew} className="text-blue-400 underline">Home</button>
    </div>
  );

  const ScoreCard = ({ title, icon: Icon, data, color }: any) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-3">
        <div className="flex justify-between items-start">
            <div className={`p-2 rounded-lg bg-opacity-20 ${color.bg}`}><Icon className={`w-5 h-5 ${color.text}`} /></div>
            <div className="text-2xl font-bold text-white">{data?.score || 0}/10</div>
        </div>
        <div><h4 className="font-bold text-slate-200 mb-1">{title}</h4><p className="text-xs text-slate-400 leading-relaxed">{data?.feedback || "No data."}</p></div>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">
      <div className="max-w-6xl w-full space-y-8">
        <div className="bg-gradient-to-r from-blue-600 to-emerald-600 rounded-2xl p-8 text-center relative shadow-2xl">
           <div className="absolute top-4 right-4 flex gap-2">
                <button onClick={() => router.push("/dashboard")} className="bg-black/20 p-2 rounded-lg text-white hover:bg-black/40 transition-colors" title="View Dashboard"><LayoutDashboard className="w-5 h-5" /></button>
                <button onClick={handleStartNew} className="bg-black/20 p-2 rounded-lg text-white hover:bg-black/40 transition-colors" title="Home"><Home className="w-5 h-5" /></button>
           </div>
           <h1 className="text-3xl font-bold text-white mb-2">Performance Report</h1>
           <div className="text-7xl font-bold text-white mt-2">{feedback.overall_score}/10</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ScoreCard title="Technical" icon={Trophy} data={feedback.technical} color={{ bg: "bg-blue-500", text: "text-blue-400" }} />
            <ScoreCard title="Communication" icon={Mic} data={feedback.communication} color={{ bg: "bg-purple-500", text: "text-purple-400" }} />
            <ScoreCard title="Resume Fit" icon={FileText} data={feedback.resume_fit} color={{ bg: "bg-emerald-500", text: "text-emerald-400" }} />
            <ScoreCard title="Presentation" icon={User} data={feedback.presentation} color={{ bg: "bg-orange-500", text: "text-orange-400" }} />
        </div>

        {feedback.improvements?.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="flex items-center gap-2 text-yellow-400 font-bold mb-4"><Lightbulb className="w-5 h-5" /> Recommended Areas for Improvement</h3>
                <ul className="space-y-3">
                    {feedback.improvements.map((item: string, idx: number) => (
                        <li key={idx} className="flex gap-3 text-slate-300 text-sm bg-slate-950 p-3 rounded-lg border border-slate-800"><span className="text-yellow-500 font-bold">{idx + 1}.</span> {item}</li>
                    ))}
                </ul>
            </div>
        )}
      </div>
    </main>
  );
}