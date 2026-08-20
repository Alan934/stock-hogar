"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

export function SearchBox({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }

    const timer = setTimeout(() => {
      startTransition(() => {
        router.replace(value.trim() ? `/buscar?q=${encodeURIComponent(value)}` : "/buscar");
      });
    }, 280);

    return () => clearTimeout(timer);
  }, [value, router]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Queso, papel higiénico, yerba…"
        aria-label="Buscar productos"
        autoFocus
        className="w-full rounded-xl border border-input bg-surface py-3 pl-11 pr-11 text-[15px] placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
      />
      {pending ? (
        <Loader2 className="absolute right-3.5 top-1/2 size-4.5 -translate-y-1/2 animate-spin text-muted" />
      ) : value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
