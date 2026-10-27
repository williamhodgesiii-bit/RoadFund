"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type Tone = "ok" | "error" | "info";
interface Toast {
  id: number;
  tone: Tone;
  text: string;
}

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (text: string, tone: Tone = "ok") => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, tone, text }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 9000 : 4500);
    },
    [dismiss],
  );
  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-md animate-rise items-start gap-3 rounded-xl px-4 py-3 shadow-lift ${
              t.tone === "error" ? "bg-brick text-white" : t.tone === "info" ? "bg-charcoal text-white" : "bg-pine text-white"
            }`}
          >
            {t.tone === "error" ? <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />}
            <p className="flex-1 text-[0.95rem] leading-snug">{t.text}</p>
            <button onClick={() => dismiss(t.id)} className="-m-1 rounded p-1 opacity-80 hover:opacity-100" aria-label="Dismiss">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
