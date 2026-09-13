"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs"; 
import Vapi from "@vapi-ai/web";
import { useInterview } from "../context/InterviewContext";
import { apiClient } from "../../lib/apiClient";
import { Mic, AlertCircle, Play, Copy, Check, Loader2, Home, Star, Send, Volume2, MicOff } from "lucide-react";

// CONFIG
const vapiPublicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? "";
const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ?? "";

const vapi = new Vapi(vapiPublicKey);

export default function InterviewPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const { 
    sessionId, setSessionId,
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
  const [activePhase, setActivePhase] = useState<string>("introduction");
  
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSubmittingRef = useRef<boolean>(false);

  // Synchronize Clerk auth token with apiClient
  useEffect(() => {
    getToken().then((token) => apiClient.setToken(token)).catch(() => {});
  }, [getToken]);

  useEffect(() => {
    if (!extractedData) router.push("/");
  }, [extractedData, router]);

  // Ensure sessionId is tracked
  const activeSessionId = sessionId || extractedData?.sessionId;
  useEffect(() => {
    if (!sessionId && extractedData?.sessionId) {
      setSessionId(extractedData.sessionId);
    }
  }, [sessionId, extractedData, setSessionId]);

  // --- CAMERA INIT ---
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        console.warn("Camera access optional/denied", e);
      }
    };
    startCamera();
    
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const speakText = useCallback((text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // --- Process candidate answer through LangGraph Orchestrator ---
  const processCandidateAnswer = useCallback(
    async (answerText: string) => {
      if (!answerText.trim() || isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setIsTyping(true);

      const targetSessionId = activeSessionId || "session-active";

      try {
        const token = await getToken();
        apiClient.setToken(token);

        // Invoke LangGraph Observer -> Interviewer -> (on close) Evaluator pipeline
        const result = await apiClient.submitAnswer(targetSessionId, {
          answer: answerText,
          silence_ms: 0,
        });

        if (result.phase) {
          setActivePhase(result.phase);
        }

        const agentQuestion =
          result.action?.question ||
          "Could you expand on your technical approach?";

        setTranscript((prev) => [...prev, { role: "assistant", content: agentQuestion }]);

        // Speak via Vapi if connected or browser speech synthesis
        try {
          if (interactionMode === "voice" && vapiPublicKey && assistantId) {
            vapi.say(agentQuestion);
          } else {
            speakText(agentQuestion);
          }
        } catch {
          speakText(agentQuestion);
        }

        // Conclude if session marked complete by orchestrator
        if (result.sessionComplete || result.phase === "closing") {
          if (result.evaluation) {
            setFeedback(result.evaluation);
            setTimeout(() => router.push("/feedback"), 3000);
          } else {
            setTimeout(() => handleEndSession(), 3000);
          }
        }
      } catch (err: any) {
        console.error("Turn submission error:", err);
        // Fallback gracefully so conversation is never stuck
        const fallbackReply = "Thank you. Let's delve into your technical background and experience.";
        setTranscript((prev) => [...prev, { role: "assistant", content: fallbackReply }]);
        speakText(fallbackReply);
      } finally {
        setIsTyping(false);
        isSubmittingRef.current = false;
      }
    },
    [activeSessionId, getToken, interactionMode, router, setFeedback, setTranscript, speakText]
  );

  // --- VAPI LISTENERS (VOICE MODE) ---
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
        if (msg.transcriptType === "final" && msg.role === "user") {
          const userSpeech = msg.transcript.trim();
          setPartialTranscript("");
          if (userSpeech) {
            setTranscript((prev) => [...prev, { role: "user", content: userSpeech }]);
            // Send candidate speech to multi-agent LangGraph orchestrator!
            processCandidateAnswer(userSpeech);
          }
        }
      }
    };

    const onError = (e: any) => { 
      console.error("[Vapi Error]", e); 
      setError(`Audio Connection Notice: ${e.error?.message || "Using Web Speech mode."}`); 
    };

    if (vapiPublicKey && assistantId) {
      vapi.on("call-start", onCallStart);
      vapi.on("call-end", onCallEnd);
      vapi.on("message", onMessage);
      vapi.on("error", onError);
    }
    
    return () => { 
      if (vapiPublicKey && assistantId) {
        try { vapi.stop(); vapi.removeAllListeners(); } catch {}
      }
    };
  }, [interactionMode, processCandidateAnswer]);

  useEffect(() => { 
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }); 
  }, [transcript, partialTranscript]);

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    if (vapiPublicKey && assistantId) {
      try { vapi.setMuted(newState); } catch {}
    }
    setStatus(newState ? "Mic Muted" : "Listening...");
  };

  const copyTranscript = () => {
    const text = transcript.map((t) => `${t.role.toUpperCase()}: ${t.content}`).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startSession = async () => {
    setError(null);
    const candidateName = user?.fullName || extractedData?.candidate_info?.name || "Candidate";
    const initialMsg = `Hello ${candidateName}! I am Alex, your Lead Interviewer. To get started, could you briefly introduce yourself and share your background?`;

    // Chat Mode Start
    if (interactionMode === "chat") {
      setIsSessionActive(true);
      setTranscript([{ role: "assistant", content: initialMsg }]);
      setStatus("Chat Active");
      speakText(initialMsg);
      return;
    }

    // Voice Mode Start
    try {
      setStatus("Requesting Mic...");
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      setIsSessionActive(true);
      setTranscript([{ role: "assistant", content: initialMsg }]);
      setStatus("Voice Active");

      if (vapiPublicKey && assistantId) {
        setStatus("Connecting Voice Engine...");
        const systemPrompt = `You are a voice relay assistant for RecruitAI. Listen to the candidate, transcribe their words accurately, and relay responses verbatim.`;
        await vapi.start(assistantId, {
          model: {
            provider: "google",
            model: "gemini-2.5-flash-lite",
            messages: [{ role: "system", content: systemPrompt }],
          },
        });
        vapi.say(initialMsg);
      } else {
        // Fallback to browser SpeechSynthesis and standard interaction
        speakText(initialMsg);
      }
    } catch (err: any) {
      console.warn("Vapi start fallback:", err);
      setIsSessionActive(true);
      setTranscript([{ role: "assistant", content: initialMsg }]);
      speakText(initialMsg);
      setStatus("Voice Active (Web Speech)");
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput("");
    setTranscript((prev) => [...prev, { role: "user", content: userMsg }]);

    // Submit turn through orchestrator
    await processCandidateAnswer(userMsg);
  };

  const handleEndSession = async () => {
    if (interactionMode === "voice" && vapiPublicKey && assistantId) { 
      try { vapi.stop(); } catch {} 
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }

    setIsSessionActive(false);
    setStatus("Generating LangGraph Evaluation Report...");
    
    try {
      const token = await getToken();
      apiClient.setToken(token);

      const targetSessionId = activeSessionId || "session-feedback";
      const evalReport = await apiClient.generateFeedback({ 
        sessionId: targetSessionId,
        transcript,
        user_id: user?.id || "guest",
        job_role: jobDescription,
      });

      if (evalReport) {
        setFeedback(evalReport);
        router.push("/feedback");
      }
    } catch (e) { 
      console.error("Evaluation report error:", e); 
      setError("Feedback Generation Encountered an Issue. Please try again."); 
    }
  };

  if (!extractedData) {
    return (
      <div className="p-10 min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500"/>
        <p className="text-slate-400">Loading Interview Context...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col lg:flex-row gap-6">
       
       {/* LEFT: INTERVIEW UI */}
       <div className="flex-1 flex flex-col">
           <header className="flex justify-between items-center mb-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{user?.fullName || extractedData.candidate_info?.name || "Candidate"}</h2>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                   <span>{user?.primaryEmailAddress?.emailAddress || extractedData.candidate_info?.email || "candidate@recruitai.com"}</span>
                   <span className="px-2 py-0.5 bg-blue-950 border border-blue-800 text-blue-300 rounded text-xs uppercase tracking-wider font-semibold">
                      Phase: {activePhase}
                   </span>
                   <span className="px-2 py-0.5 bg-slate-800 rounded text-xs uppercase tracking-wider text-emerald-400">{interviewType}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                  {transcript.length > 0 && (
                    <button onClick={copyTranscript} className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-3 py-2 rounded-lg transition-colors">
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy"}
                    </button>
                  )}
                  <button onClick={handleEndSession} className="flex items-center gap-2 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-lg shadow-md transition-colors">
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
                        <h3 className="text-2xl font-bold text-white">Ready for your Mock Interview?</h3>
                        <p className="text-slate-400 max-w-md">
                            {interactionMode === 'voice' 
                                ? "Speak clearly into your microphone. The AI will listen and adapt questions to your responses." 
                                : "Type your answers below. The multi-agent orchestrator will evaluate each response."}
                        </p>
                        <button 
                            onClick={startSession} 
                            className="flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-full text-xl font-bold text-white shadow-xl transition-transform hover:scale-105 active:scale-95 mx-auto"
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
                                {msg.role === 'user' ? 'You' : 'Alex (Lead Interviewer)'}
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
                
                {isTyping && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs italic bg-slate-800/40 p-2 rounded-lg w-fit border border-slate-700/50">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                    <span>Alex is formulating the next adaptive question...</span>
                  </div>
                )}
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
                    <input 
                      type="text" 
                      value={chatInput} 
                      onChange={(e) => setChatInput(e.target.value)} 
                      placeholder="Type your response to Alex..." 
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-colors" 
                      autoFocus 
                    />
                    <button type="submit" disabled={isTyping} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 rounded-xl font-medium transition-colors">
                      <Send className="w-5 h-5" />
                    </button>
                 </form>
              )}
              <div className="font-mono text-xs text-slate-500">Status: <span className="text-emerald-400 font-semibold">{status}</span></div>
           </div>
       </div>

       {/* RIGHT: CAMERA MIRROR */}
       <div className="w-80 hidden lg:flex flex-col gap-4 justify-center h-full">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden aspect-video relative shadow-xl ring-1 ring-slate-700/50">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform -scale-x-100" />
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] flex items-center gap-2 text-white font-medium border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> Live Camera
                </div>
            </div>
            
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 backdrop-blur-sm">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Candidate Info</h4>
                <p className="font-bold text-white truncate">{user?.fullName || "Candidate"}</p>
                <p className="text-xs text-slate-400 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
                <div className="mt-3 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                  <span className="text-slate-500 block">Session ID:</span>
                  <span className="font-mono text-[10px] text-blue-300 break-all">{activeSessionId || "Initializing..."}</span>
                </div>
            </div>
       </div>

    </main>
  );
}