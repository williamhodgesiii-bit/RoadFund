"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type Tone = "ok" | "error" | "info";
interface Action {
  label: string;
  onClick: () => void;
}
interface Toast {
  id: number;
  tone: Tone;
  text: string;
  action?: Action;
}

const ToastContext = createContext<(text: string, tone?: Tone, action?: Action) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (text: string, tone: Tone = "ok", action?: Action) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, tone, text, action }]);
      // Messages with an Undo stay up long enough to read and reach.
      window.setTimeout(() => dismiss(id), action ? 12000 : tone === "error" ? 9000 : 4500);
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
            className={`pointer-events-auto flex w-full max-w-md animate-rise items-start gap-3 rounded-lg px-4 py-3 shadow-lift ${
              t.tone === "error" ? "bg-brick text-white" : t.tone === "info" ? "bg-charcoal text-white" : "bg-pine text-white"
            }`}
          >
            {t.tone === "error" ? <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />}
            <p className="flex-1 leading-snug">{t.text}</p>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className="-my-1 min-h-10 rounded-lg bg-white/15 px-3 font-semibold underline hover:bg-white/25"
              >
                {t.action.label}
              </button>
            )}
            <button onClick={() => dismiss(t.id)} className="-m-1 rounded p-1 opacity-80 hover:opacity-100" aria-label="Dismiss">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
