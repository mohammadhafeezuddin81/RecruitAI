"use client";
import { useRouter } from "next/navigation";
import { useInterview } from "../context/InterviewContext";
import {
  Trophy,
  Mic,
  BrainCircuit,
  Award,
  Home,
  Lightbulb,
  LayoutDashboard,
  CheckCircle2,
  AlertTriangle,
  FileText,
  TrendingUp,
} from "lucide-react";

export default function FeedbackPage() {
  const router = useRouter();
  const { feedback, resetSession } = useInterview();

  const handleStartNew = () => {
    resetSession();
    router.push("/");
  };

  if (!feedback) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-10 flex flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-bold">Loading Performance Report...</h2>
        <p className="text-slate-400 text-sm">Synthesizing LangGraph evaluation metrics.</p>
        <button onClick={handleStartNew} className="text-blue-400 underline hover:text-blue-300">
          Return to Setup
        </button>
      </div>
    );
  }

  // Normalized score calculations (supports both 0-100 and /10)
  const rawOverall = feedback.overall_score_100 ?? (feedback.overall_score ? (feedback.overall_score <= 10 ? feedback.overall_score * 10 : feedback.overall_score) : 75);
  const overall100 = Math.min(100, Math.max(0, Math.round(rawOverall)));
  const overall10 = (overall100 / 10).toFixed(1);

  const getScore100 = (scoreVal: any, subObj: any, fallback: number) => {
    if (typeof scoreVal === "number") return scoreVal <= 10 ? scoreVal * 10 : scoreVal;
    if (subObj?.score_100) return subObj.score_100;
    if (subObj?.score) return subObj.score <= 10 ? subObj.score * 10 : subObj.score;
    return fallback;
  };

  const techScore = getScore100(feedback.technical_score, feedback.technical, 75);
  const commScore = getScore100(feedback.communication_score, feedback.communication, 80);
  const probScore = getScore100(feedback.problem_solving_score, feedback.resume_fit, 70);

  const strengths: string[] = feedback.strengths || [
    "Clear and structured articulation of concepts",
    "Solid understanding of core software paradigms",
  ];
  const weaknesses: string[] = feedback.weaknesses || [
    "Could provide more empirical system trade-offs",
    "Elaborate on edge-case error recovery mechanisms",
  ];
  const recommendations: string[] =
    feedback.recommendations || feedback.improvements || [
      "Practice breaking down distributed architecture bottlenecks using latency numbers",
      "Structure responses with the STAR method for behavioral and scenario questions",
    ];

  const MetricCard = ({
    title,
    score,
    icon: Icon,
    color,
    feedbackText,
  }: {
    title: string;
    score: number;
    icon: any;
    color: { border: string; bg: string; text: string; bar: string };
    feedbackText?: string;
  }) => (
    <div className={`bg-slate-900/90 border ${color.border} rounded-2xl p-6 flex flex-col gap-4 shadow-xl backdrop-blur-sm`}>
      <div className="flex justify-between items-start">
        <div className={`p-3 rounded-xl ${color.bg}`}>
          <Icon className={`w-6 h-6 ${color.text}`} />
        </div>
        <div className="text-right">
          <div className="text-3xl font-extrabold text-white">{score}<span className="text-sm font-normal text-slate-400">/100</span></div>
          <span className="text-xs text-slate-400">({(score / 10).toFixed(1)} / 10)</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
        <div className={`h-2.5 rounded-full ${color.bar}`} style={{ width: `${Math.min(100, Math.max(5, score))}%` }}></div>
      </div>

      <div>
        <h4 className="font-bold text-white text-base mb-1">{title}</h4>
        <p className="text-xs text-slate-400 leading-relaxed">
          {feedbackText || "Evaluated against role benchmarks."}
        </p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 flex flex-col items-center">
      <div className="max-w-6xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* HERO BANNER */}
        <div className="relative overflow-hidden bg-linear-to-r from-blue-600 via-indigo-600 to-emerald-600 rounded-3xl p-8 md:p-12 text-center shadow-2xl">
          <div className="absolute top-6 right-6 flex gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="bg-black/30 hover:bg-black/50 text-white p-2.5 rounded-xl backdrop-blur-md transition-all flex items-center gap-2 text-xs font-medium border border-white/10"
              title="Dashboard"
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button
              onClick={handleStartNew}
              className="bg-black/30 hover:bg-black/50 text-white p-2.5 rounded-xl backdrop-blur-md transition-all flex items-center gap-2 text-xs font-medium border border-white/10"
              title="New Session"
            >
              <Home className="w-4 h-4" /> Start New
            </button>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-white/90 text-xs font-medium uppercase tracking-wider mb-4 border border-white/10">
            <Award className="w-3.5 h-3.5" /> LangGraph Evaluation Report
          </div>
          
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3">
            Interview Performance Assessment
          </h1>
          <p className="text-blue-100 text-sm md:text-base max-w-xl mx-auto mb-6">
            Multi-agent evaluation calibrated across technical depth, problem-solving, and communication clarity.
          </p>

          <div className="inline-flex items-baseline gap-2 bg-black/30 backdrop-blur-md px-8 py-4 rounded-2xl border border-white/15 shadow-inner">
            <span className="text-6xl md:text-7xl font-black text-white">{overall100}</span>
            <span className="text-xl md:text-2xl font-bold text-emerald-300">/100</span>
            <span className="text-xs text-white/60 ml-2">({overall10} / 10)</span>
          </div>
        </div>

        {/* 3 CORE PILLARS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            title="Technical Competency"
            score={techScore}
            icon={Trophy}
            color={{
              border: "border-blue-800/60",
              bg: "bg-blue-600/20",
              text: "text-blue-400",
              bar: "bg-gradient-to-r from-blue-500 to-indigo-500",
            }}
            feedbackText={feedback.technical?.feedback || feedback.detailed_feedback}
          />
          <MetricCard
            title="Communication & Clarity"
            score={commScore}
            icon={Mic}
            color={{
              border: "border-purple-800/60",
              bg: "bg-purple-600/20",
              text: "text-purple-400",
              bar: "bg-gradient-to-r from-purple-500 to-pink-500",
            }}
            feedbackText={feedback.communication?.feedback || "Evaluated articulation, cadence, and active listening."}
          />
          <MetricCard
            title="Problem Solving & Judgment"
            score={probScore}
            icon={BrainCircuit}
            color={{
              border: "border-emerald-800/60",
              bg: "bg-emerald-600/20",
              text: "text-emerald-400",
              bar: "bg-gradient-to-r from-emerald-500 to-teal-500",
            }}
            feedbackText={feedback.resume_fit?.feedback || "Analytical depth and adaptability during scenarios."}
          />
        </div>

        {/* STRENGTHS & GAPS SPLIT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Key Strengths */}
          <div className="bg-slate-900 border border-emerald-900/40 rounded-2xl p-6 shadow-lg">
            <h3 className="flex items-center gap-2 text-emerald-400 font-bold text-lg mb-4">
              <CheckCircle2 className="w-5 h-5" /> Demonstrated Strengths
            </h3>
            <ul className="space-y-3">
              {strengths.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 text-slate-300 text-sm bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Gaps / Weaknesses */}
          <div className="bg-slate-900 border border-amber-900/40 rounded-2xl p-6 shadow-lg">
            <h3 className="flex items-center gap-2 text-amber-400 font-bold text-lg mb-4">
              <AlertTriangle className="w-5 h-5" /> Areas for Growth
            </h3>
            <ul className="space-y-3">
              {weaknesses.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 text-slate-300 text-sm bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ACTIONABLE RECOMMENDATIONS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <h3 className="flex items-center gap-2 text-yellow-400 font-bold text-lg mb-4">
            <Lightbulb className="w-5 h-5" /> Actionable Recommendations for Upcoming Interviews
          </h3>
          <ul className="space-y-3">
            {recommendations.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 text-slate-300 text-sm bg-slate-950 p-4 rounded-xl border border-slate-800"
              >
                <span className="text-yellow-500 font-bold font-mono text-sm">{idx + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* DETAILED EXECUTIVE FEEDBACK */}
        {feedback.detailed_feedback && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-lg">
            <h3 className="flex items-center gap-2 text-blue-400 font-bold text-lg mb-2">
              <FileText className="w-5 h-5" /> Evaluator Executive Summary
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
              {feedback.detailed_feedback}
            </p>
          </div>
        )}

        {/* BOTTOM ACTION BAR */}
        <div className="flex justify-center gap-4 pt-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold text-sm transition-colors border border-slate-700 flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" /> View Full Dashboard & History
          </button>
          <button
            onClick={handleStartNew}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg"
          >
            Start Another Practice Session
          </button>
        </div>

      </div>
    </main>
  );
}