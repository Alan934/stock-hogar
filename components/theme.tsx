"use client";

import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { useIsMounted } from "@/components/hooks";
import { cn } from "@/lib/utils";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "system", label: "Auto", icon: Monitor },
  { value: "dark", label: "Oscuro", icon: Moon },
] as const;

/** Selector de tres posiciones: claro / automático / oscuro. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useIsMounted();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-surface-2 p-1",
        className,
      )}
      role="radiogroup"
      aria-label="Tema de la aplicación"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition-colors",
              active
                ? "bg-surface text-primary shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
