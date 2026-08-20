"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };

const ToastContext = createContext<{
  notify: (message: string, tone?: ToastTone) => void;
}>({ notify: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3600);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone];
          return (
            <div
              key={toast.id}
              role="status"
              className={cn(
                "animate-pop pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg",
                toast.tone === "success" &&
                  "border-success/30 bg-success-soft text-success",
                toast.tone === "error" &&
                  "border-danger/30 bg-danger-soft text-danger",
                toast.tone === "info" &&
                  "border-border bg-surface text-foreground",
              )}
            >
              <Icon className="mt-px size-4 shrink-0" />
              <span>{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
