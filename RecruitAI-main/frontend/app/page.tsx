"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs"; 
import axios from "axios";
import { useInterview } from "./context/InterviewContext";
import { Upload, Briefcase, Settings, MessageSquare, Mic, FileText, Loader2, RotateCcw, ArrowRight, Sparkles, Heart, Cpu } from "lucide-react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000";

export default function SetupPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const { 
    jobDescription, setJobDescription, 
    interviewType, setInterviewType, 
    interactionMode, setInteractionMode, 
    setExtractedData, resetSession 
  } = useInterview();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("Idle");

  useEffect(() => { if (!isProcessing) resetSession(); }, []); 

  // --- 1. LOADING STATE ---
  if (!isLoaded) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
    </div>
  );

  // --- 2. LANDING PAGE (IF LOGGED OUT) ---
  if (!isSignedIn) return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30 relative overflow-hidden">
        {/* Ambient Background */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Hero Content */}
        <div className="max-w-6xl mx-auto px-6 py-24 text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/50 border border-slate-800 text-xs font-medium text-blue-400 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <Sparkles className="w-3 h-3" /> AI-Powered Interview Coach
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
                Master Your Next <br />
                <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                    Interview with AI
                </span>
            </h1>
            
            <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                Antriview conducts realistic mock interviews, analyzes your resume, and provides brutal, data-driven feedback to help you get hired.
            </p>

            <SignInButton mode="modal">
                <button className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg transition-all shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] hover:shadow-[0_0_60px_-15px_rgba(37,99,235,0.6)] hover:scale-105 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                    Get Started <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
            </SignInButton>
        </div>

        {/* Features Grid */}
        <div className="max-w-6xl mx-auto px-6 pb-24">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 transition-colors hover:bg-slate-900/80 group">
                    <div className="w-12 h-12 bg-blue-900/30 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <FileText className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Resume Analysis</h3>
                    <p className="text-slate-400 text-sm">Upload your PDF. The AI reads your skills and tailors questions specifically to your experience.</p>
                </div>

                <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-purple-500/50 transition-colors hover:bg-slate-900/80 group">
                    <div className="w-12 h-12 bg-purple-900/30 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Mic className="w-6 h-6 text-purple-400" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Voice Interaction</h3>
                    <p className="text-slate-400 text-sm">Speak naturally. Our low-latency voice engine mimics a real human conversation.</p>
                </div>

                <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/50 transition-colors hover:bg-slate-900/80 group">
                    <div className="w-12 h-12 bg-emerald-900/30 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Cpu className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Smart Feedback</h3>
                    <p className="text-slate-400 text-sm">Get a detailed score on Technical knowledge, Communication, and actionable tips to improve.</p>
                </div>
            </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-800 bg-slate-950 py-12 text-center relative z-10">
            <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
                Made with <Heart className="w-4 h-4 text-red-500 fill-red-500 animate-pulse" /> by <span className="text-white font-semibold">Shiva Balaji Kontham</span>
            </p>
            <p className="text-slate-600 text-xs mt-2">Built for Eightfold AI Agent Hackathon</p>
        </footer>
    </div>
  );

  // --- 3. LOGGED IN DASHBOARD (SETUP) ---
  const handleContextSubmit = async (e: React.ChangeEvent<HTMLInputElement> | null) => {
    const file = e ? e.target.files?.[0] : null;
    setIsProcessing(true);
    setStatus(file ? "Analyzing Resume..." : "Loading Standard Questions...");

    const formData = new FormData();
    formData.append("user_id", user.id); 
    if (file) formData.append("file", file);
    formData.append("job_description", jobDescription || "General Software Engineering");

    try {
      const res = await axios.post(`${backendUrl}/process-context`, formData);
      setExtractedData(res.data);
      router.push("/interview");
    } catch (err) {
      console.error(err);
      setStatus("Error. Check Backend.");
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0B0E14] text-slate-100 p-8 flex items-center justify-center relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-2xl w-full space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Header */}
        <header className="text-center relative">
          <h1 className="text-4xl font-bold mb-2">
            Hello, <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">{user.firstName}</span>
          </h1>
          <p className="text-slate-400">Configure your session to start practicing.</p>
          <button onClick={resetSession} className="absolute right-0 top-0 text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </header>

        {/* Main Card */}
        <div className="space-y-6 backdrop-blur-xl bg-white/5 border border-white/10 p-8 rounded-3xl shadow-2xl">
          
          {/* Job Description Input */}
          <div className="space-y-3">
             <label className="flex items-center gap-2 text-sm font-semibold text-blue-400 uppercase tracking-wider">
                <Briefcase className="w-4 h-4" /> Target Role
             </label>
             <textarea 
                className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600 resize-none"
                rows={3}
                placeholder="Paste Job Description here (e.g. Senior React Developer)..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
             />
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Interview Style */}
            <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-purple-400 uppercase tracking-wider">
                    <Settings className="w-4 h-4" /> Style
                </label>
                <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-white/5">
                    {['technical', 'hr'].map((mode) => (
                    <button 
                        key={mode} 
                        onClick={() => setInterviewType(mode)} 
                        className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                            interviewType === mode 
                            ? 'bg-purple-600 text-white shadow-lg' 
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        {mode}
                    </button>
                    ))}
                </div>
            </div>

            {/* Interaction Mode */}
            <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-orange-400 uppercase tracking-wider">
                    <MessageSquare className="w-4 h-4" /> Mode
                </label>
                <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-white/5">
                    <button 
                        onClick={() => setInteractionMode("voice")} 
                        className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                            interactionMode === 'voice' 
                            ? 'bg-orange-600 text-white shadow-lg' 
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Mic className="w-3 h-3" /> Voice
                    </button>
                    <button 
                        onClick={() => setInteractionMode("chat")} 
                        className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                            interactionMode === 'chat' 
                            ? 'bg-orange-600 text-white shadow-lg' 
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <MessageSquare className="w-3 h-3" /> Chat
                    </button>
                </div>
            </div>
          </div>

          {/* Upload Area */}
          <div className="group relative border-2 border-dashed border-white/10 rounded-2xl p-8 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all cursor-pointer">
              <input 
                type="file" 
                className="absolute inset-0 z-20 opacity-0 cursor-pointer" 
                onChange={handleContextSubmit} 
                accept=".pdf" 
                disabled={isProcessing}
              />
              <div className="flex flex-col items-center justify-center text-center">
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-3 animate-pulse">
                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" /> 
                    <span className="text-emerald-400 font-medium">Analyzing Resume...</span>
                  </div>
                ) : (
                  <>
                    <div className="p-3 bg-emerald-500/10 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                        Click to Upload Resume (PDF)
                    </p>
                    <p className="text-xs text-slate-500 mt-1">AI will tailor questions to your skills</p>
                  </>
                )}
              </div>
          </div>
          
          {/* Skip Option */}
           {!isProcessing && (
              <div className="text-center">
                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-white/10"></div>
                    <span className="flex-shrink-0 mx-4 text-slate-600 text-xs uppercase tracking-widest">OR</span>
                    <div className="flex-grow border-t border-white/10"></div>
                  </div>
                  <button 
                    onClick={() => handleContextSubmit(null)}
                    className="mt-2 text-sm text-slate-400 hover:text-white flex items-center justify-center gap-2 transition-colors mx-auto"
                  >
                     <FileText className="w-4 h-4" /> Continue without Resume (General Questions)
                  </button>
              </div>
          )}
        </div>
      </div>
    </main>
  );
}
