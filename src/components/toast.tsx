"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Tone = "success" | "info" | "error";
interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

const TONE: Record<Tone, string> = {
  success: "bg-ink text-white [&_.dot]:bg-[#5fd39b]",
  info: "bg-ink text-white [&_.dot]:bg-[#8fb1ff]",
  error: "bg-high text-white [&_.dot]:bg-white",
};

/** Small confirmations after an action ("Fix accepted", "Sent to the expert reviewer"). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Tone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <p key={t.id} role="status" className={`toast-in flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-[14px] font-medium shadow-lg ${TONE[t.tone]}`}>
            <span className="dot size-2 rounded-full" aria-hidden="true" />
            {t.text}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
