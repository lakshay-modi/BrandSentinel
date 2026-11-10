"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Tone = "success" | "info" | "error";
export interface ToastOptions {
  /** a button in the toast, for example Undo */
  action?: { label: string; onClick: () => void };
  /** how long it stays, in ms; with an action, a countdown shows the seconds left */
  duration?: number;
}
interface Toast extends ToastOptions {
  id: number;
  text: string;
  tone: Tone;
  until: number;
}

type Push = (text: string, tone?: Tone, options?: ToastOptions) => () => void;
const ToastContext = createContext<Push>(() => () => {});

const TONE: Record<Tone, string> = {
  success: "bg-ink text-white [&_.dot]:bg-[#5fd39b]",
  info: "bg-ink text-white [&_.dot]:bg-[#8fb1ff]",
  error: "bg-high text-white [&_.dot]:bg-white",
};

function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{Math.max(0, Math.ceil((until - now) / 1000))}</span>;
}

/** Small confirmations after an action ("Fix accepted"), some with an Undo button. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback<Push>(
    (text, tone = "success", options = {}) => {
      const id = Date.now() + Math.random();
      const duration = options.duration ?? (options.action ? 5000 : 3600);
      setToasts((t) => [...t.slice(-2), { id, text, tone, ...options, until: Date.now() + duration }]);
      setTimeout(() => dismiss(id), duration);
      return () => dismiss(id);
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={`toast-in flex items-center gap-2.5 rounded-xl py-2.5 pl-4 text-[14px] font-medium shadow-lg ${t.action ? "pointer-events-auto pr-2" : "pr-4"} ${TONE[t.tone]}`}>
            <span className="dot size-2 shrink-0 rounded-full" aria-hidden="true" />
            <span>{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className="ml-1 rounded-lg bg-white/15 px-3 py-1 text-[13px] font-bold hover:bg-white/25"
              >
                {t.action.label} (<Countdown until={t.until} />)
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
