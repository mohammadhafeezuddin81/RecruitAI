import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { InterviewProvider } from "./context/InterviewContext";
import Navbar from "../components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = { title: "Antriview", description: "AI Interview Coach" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.className} bg-slate-950`}>
          <InterviewProvider>
            <Navbar />
            {children}
          </InterviewProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}