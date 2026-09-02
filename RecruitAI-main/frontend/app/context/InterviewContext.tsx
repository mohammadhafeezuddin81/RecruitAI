"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface InterviewContextType {
  jobDescription: string;
  setJobDescription: (jd: string) => void;
  interviewType: string;
  setInterviewType: (type: string) => void;
  interactionMode: "voice" | "chat";
  setInteractionMode: (mode: "voice" | "chat") => void;
  extractedData: any;
  setExtractedData: (data: any) => void;
  transcript: any[];
  setTranscript: (transcript: any[]) => void;
  feedback: any;
  setFeedback: (feedback: any) => void;
  resetSession: () => void;
}

const InterviewContext = createContext<InterviewContextType | undefined>(undefined);

export function InterviewProvider({ children }: { children: ReactNode }) {
  const [jobDescription, setJobDescription] = useState("");
  const [interviewType, setInterviewType] = useState("technical");
  const [interactionMode, setInteractionMode] = useState<"voice" | "chat">("voice");
  const [extractedData, setExtractedData] = useState<any>(null);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("antriview_data");
      if (saved) {
        try {
          const p = JSON.parse(saved);
          setJobDescription(p.jobDescription || "");
          setInterviewType(p.interviewType || "technical");
          setInteractionMode(p.interactionMode || "voice");
          setExtractedData(p.extractedData || null);
          setTranscript(p.transcript || []);
          setFeedback(p.feedback || null);
        } catch (e) { console.error("Load failed", e); }
      }
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded) {
      const data = { jobDescription, interviewType, interactionMode, extractedData, transcript, feedback };
      localStorage.setItem("antriview_data", JSON.stringify(data));
    }
  }, [jobDescription, interviewType, interactionMode, extractedData, transcript, feedback, isLoaded]);

  const resetSession = () => {
    setJobDescription("");
    setExtractedData(null);
    setTranscript([]);
    setFeedback(null);
    localStorage.removeItem("antriview_data");
  };

  return (
    <InterviewContext.Provider value={{
      jobDescription, setJobDescription,
      interviewType, setInterviewType,
      interactionMode, setInteractionMode,
      extractedData, setExtractedData,
      transcript, setTranscript,
      feedback, setFeedback,
      resetSession
    }}>
      {children}
    </InterviewContext.Provider>
  );
}

export function useInterview() {
  const context = useContext(InterviewContext);
  if (!context) throw new Error("useInterview error");
  return context;
}