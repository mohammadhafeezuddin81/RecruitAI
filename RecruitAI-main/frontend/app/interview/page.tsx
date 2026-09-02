"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs"; 
import Vapi from "@vapi-ai/web";
import axios from "axios";
import { useInterview } from "../context/InterviewContext";
import { Mic, Square, AlertCircle, Play, Copy, Check, Loader2, Home, Star, Send, Volume2, MicOff, Video } from "lucide-react";

// CONFIG
const vapiPublicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? "";
const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ?? "";
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000";

const vapi = new Vapi(vapiPublicKey);

export default function InterviewPage() {
  const { user } = useUser();
  const router = useRouter();
  const { 
    extractedData, jobDescription, interviewType, interactionMode, 
    transcript, setTranscript, setFeedback 
  } = useInterview();

  const [status, setStatus] = useState("Ready to Start");
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState(""); 
  const [isTyping, setIsTyping] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState(""); 
  
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!extractedData) router.push("/");
  }, [extractedData, router]);

  // --- CAMERA INIT ---
  useEffect(() => {
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (e) { console.warn("Camera denied", e); }
    };
    startCamera();
    
    // Cleanup: Stop camera tracks when leaving page
    return () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    };
  }, []);

  // --- VAPI LISTENERS ---
  useEffect(() => {
    if (interactionMode === "chat") return;

    const onCallStart = () => { 
        setStatus("Voice Active"); 
        setIsSessionActive(true); 
        setIsMuted(false); 
    };
    
    const onCallEnd = () => handleEndSession();
    
    const onMessage = (msg: any) => {
      if (msg.type === "transcript") {
          if (msg.transcriptType === "partial" && msg.role === "user") {
              setPartialTranscript(msg.transcript);
          }
          if (msg.transcriptType === "final") {
            setPartialTranscript("");
            setTranscript(prev => {
                if (prev.length === 0) return [{ role: msg.role, content: msg.transcript }];
                const lastMsg = prev[prev.length - 1];
                if (lastMsg.role === msg.role) {
                    const newText = msg.transcript.trim();
                    const oldText = lastMsg.content.trim();
                    if (oldText.includes(newText)) return prev; 
                    const updated = [...prev];
                    updated[updated.length - 1] = { ...lastMsg, content: oldText + " " + newText };
                    return updated;
                }
                return [...prev, { role: msg.role, content: msg.transcript }];
            });
          }
      }
    };

    const onError = (e: any) => { 
        console.error(e); 
        setError(`Connection Error: ${e.error?.message || "Check Mic"}`); 
        setIsSessionActive(false);
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("error", onError);
    
    return () => { vapi.stop(); vapi.removeAllListeners(); };
  }, [interactionMode]);

  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [transcript, partialTranscript]);

  // --- ACTIONS ---
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
    }
  };

  const toggleMute = () => {
      const newState = !isMuted;
      setIsMuted(newState);
      vapi.setMuted(newState);
      setStatus(newState ? "Mic Muted" : "Listening...");
  };

  const copyTranscript = () => {
    const text = transcript.map(t => `${t.role.toUpperCase()}: ${t.content}`).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startSession = async () => {
    setError(null);
    
    // Chat Mode Start
    if (interactionMode === "chat") {
        setIsSessionActive(true);
        const initialMsg = `Hello ${user?.firstName || ""}! I am Alex, your AI Interviewer. To begin, please introduce yourself.`;
        setTranscript([{ role: "assistant", content: initialMsg }]);
        setStatus("Chat Active");
        speakText(initialMsg);
        return;
    }

    // Voice Mode System Prompt
    // FIX: Explicitly named the agent "Alex" to prevent "I'm your name" error.
    const systemPrompt = `
      You are an Expert AI Interviewer named Alex. 
      Candidate Name: ${user?.fullName || extractedData?.candidate_info?.name || "Candidate"}.
      Role: ${jobDescription}.
      Resume Strategy: ${extractedData?.interview_strategy}.

      STRICT 8-PHASE INTERVIEW PROTOCOL:
      1. **PHASE 1 (INTRODUCTION):** Introduce yourself as Alex. Ask the candidate to introduce themselves.
      2. **PHASE 2 (WAIT & LISTEN):** Wait for their introduction. Do not interrupt.
      3. **PHASE 3 (FIRST QUESTION):** Acknowledge their intro. Ask the first core technical question based on the Job Description.
      4. **PHASE 4 (ADAPT & PROBE):** If they answer well, ask a harder follow-up. If they struggle, offer a hint.
      5. **PHASE 5 (DEEP DIVE):** Select a specific skill from their resume context and drill down.
      6. **PHASE 6 (SCENARIO):** "Imagine a scenario where..." (Situational judgment).
      7. **PHASE 7 (FEEDBACK):** Give brief, immediate validation.
      8. **PHASE 8 (CLOSING):** Ask if they have any questions for you.

      GUIDELINES:
      - Keep responses concise (2-3 sentences max).
      - Be professional but encouraging.
    `;

    try {
        setStatus("Requesting Mic...");
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        setStatus("Connecting...");
        await vapi.start(assistantId, {
            model: {
                provider: "google",
                model: "gemini-2.5-flash-lite",
                messages: [{ role: "system", content: systemPrompt }]
            }
        });
    } catch (err) {
        console.error(err);
        setError("Microphone Access Denied or API Error.");
        setStatus("Failed");
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput("");
    setTranscript(prev => [...prev, { role: "user", content: userMsg }]);
    setIsTyping(true);

    try {
      const res = await axios.post(`${backendUrl}/chat/next-turn`, {
        history: transcript,
        last_user_input: userMsg,
        job_description: jobDescription,
        interview_strategy: extractedData?.interview_strategy
      });
      const agentReply = res.data.response;
      setTranscript(prev => [...prev, { role: "assistant", content: agentReply }]);
      speakText(agentReply);
    } catch (err) { console.error(err); } finally { setIsTyping(false); }
  };

  const handleEndSession = async () => {
    // Stop Voice
    if (interactionMode === "voice") { try { vapi.stop(); } catch(e) {} }
    window.speechSynthesis.cancel();
    
    // Stop Camera Manually
    if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
    }

    setIsSessionActive(false);
    setStatus("Generating Report...");
    
    setTimeout(async () => {
        try {
            const res = await axios.post(`${backendUrl}/generate-feedback`, { 
                transcript,
                user_id: user?.id || "guest",
                job_role: jobDescription
            });
            if (res.data) { setFeedback(res.data); router.push("/feedback"); }
        } catch (e) { console.error(e); setError("Feedback Generation Failed"); }
    }, 2000);
  };

  if (!extractedData) return <div className="p-10 text-white flex justify-center"><Loader2 className="animate-spin"/></div>;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col lg:flex-row gap-6">
       
       {/* LEFT: INTERVIEW UI */}
       <div className="flex-1 flex flex-col">
           <header className="flex justify-between items-center mb-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{user?.fullName || extractedData.candidate_info?.name}</h2>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                   <span>{user?.primaryEmailAddress?.emailAddress || extractedData.candidate_info?.email}</span>
                   <span className="px-2 py-0.5 bg-slate-800 rounded text-xs uppercase tracking-wider text-blue-400">{interviewType}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                  {transcript.length > 0 && (
                    <button onClick={copyTranscript} className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-3 py-2 rounded-lg transition-colors">
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy"}
                    </button>
                  )}
                  <button onClick={handleEndSession} className="flex items-center gap-2 text-xs bg-blue-900 hover:bg-blue-800 text-blue-200 px-3 py-2 rounded-lg border border-blue-800 transition-colors">
                    <Star className="w-3 h-3" /> End & Feedback
                  </button>
                  <button onClick={() => router.push("/")} className="flex items-center gap-2 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-200 px-3 py-2 rounded-lg border border-red-800 transition-colors">
                    <Home className="w-3 h-3" /> Exit
                  </button>
              </div>
           </header>

           {error && <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-xl mb-4 flex items-center gap-2"><AlertCircle className="w-5 h-5" /> {error}</div>}

           <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-6 overflow-y-auto mb-6 custom-scrollbar relative shadow-inner">
              
              {!isSessionActive && transcript.length === 0 && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-10 rounded-xl">
                    <div className="text-center space-y-4">
                        <div className="p-4 bg-blue-600/20 rounded-full inline-block">
                            {interactionMode === 'voice' ? <Mic className="w-8 h-8 text-blue-400" /> : <Send className="w-8 h-8 text-orange-400" />}
                        </div>
                        <h3 className="text-2xl font-bold text-white">Ready to Start?</h3>
                        <p className="text-slate-400 max-w-md">
                            {interactionMode === 'voice' 
                                ? "Ensure you are in a quiet environment. Speak clearly." 
                                : "Type your answers. The AI will speak the replies."}
                        </p>
                        <button 
                            onClick={startSession} 
                            className="flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-full text-xl font-bold text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
                        >
                           <Play className="w-6 h-6 fill-current" /> Begin Interview
                        </button>
                    </div>
                 </div>
              )}

              <div className="space-y-6">
                {transcript.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-md ${
                            msg.role === 'user' 
                            ? 'bg-blue-600 text-white rounded-tr-sm' 
                            : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'
                        }`}>
                            <span className="text-xs opacity-50 block mb-1 uppercase font-bold tracking-wider">
                                {msg.role === 'user' ? 'You' : 'Interviewer'}
                            </span>
                            {msg.content}
                        </div>
                    </div>
                ))}
                
                {isSessionActive && interactionMode === 'voice' && partialTranscript && (
                    <div className="flex justify-end">
                        <div className="max-w-[80%] p-4 rounded-2xl rounded-tr-sm bg-blue-900/30 border border-blue-500/50 border-dashed text-blue-200 animate-pulse">
                            <span className="text-xs opacity-50 block mb-1 uppercase font-bold">Listening...</span>
                            {partialTranscript}
                        </div>
                    </div>
                )}
                
                {isTyping && <div className="text-slate-500 text-sm italic">Agent is typing...</div>}
              </div>
              
              <div ref={transcriptEndRef} />
           </div>

           <div className="flex justify-center flex-col items-center gap-4">
              {isSessionActive && interactionMode === "voice" && (
                 <button onClick={toggleMute} className={`flex items-center gap-2 px-8 py-4 rounded-full font-bold text-white shadow-lg transition-colors ${isMuted ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-red-600 hover:bg-red-700'}`}>
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />} {isMuted ? "Unmute" : "Mute / Pause"}
                 </button>
              )}
              {isSessionActive && interactionMode === "chat" && (
                 <form onSubmit={handleChatSubmit} className="w-full max-w-3xl flex gap-2">
                    <div className="flex items-center justify-center p-3 bg-slate-800 rounded-xl text-slate-400"><Volume2 className="w-5 h-5 text-emerald-400" /></div>
                    <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type answer..." className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none" autoFocus />
                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-xl"><Send className="w-5 h-5" /></button>
                 </form>
              )}
              <div className="font-mono text-xs text-slate-500">Status: <span className="text-emerald-400">{status}</span></div>
           </div>
       </div>

       {/* RIGHT: CAMERA MIRROR (CENTERED) */}
       <div className="w-80 hidden lg:flex flex-col gap-4 justify-center h-full">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden aspect-video relative shadow-xl ring-1 ring-slate-700/50">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform -scale-x-100" />
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] flex items-center gap-2 text-white font-medium border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> Live Camera
                </div>
            </div>
            
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 backdrop-blur-sm">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Candidate Info</h4>
                <p className="font-bold text-white truncate">{user?.fullName || "Guest User"}</p>
                <p className="text-xs text-slate-400 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
       </div>

    </main>
  );
}