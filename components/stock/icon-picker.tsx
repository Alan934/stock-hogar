"use client";

import { useState } from "react";

import { SECTOR_ICONS, type SectorIconName } from "@/components/stock/sector-icon";
import { cn } from "@/lib/utils";

export function IconPicker({
  name = "icon",
  defaultValue = "box",
}: {
  name?: string;
  defaultValue?: string;
}) {
  const [selected, setSelected] = useState(defaultValue);
  const entries = Object.entries(SECTOR_ICONS) as [
    SectorIconName,
    (typeof SECTOR_ICONS)[SectorIconName],
  ][];

  return (
    <div>
      <input type="hidden" name={name} value={selected} />
      <div className="grid max-h-44 grid-cols-6 gap-1.5 overflow-y-auto rounded-xl border border-border p-2 sm:grid-cols-8">
        {entries.map(([key, entry]) => {
          const Icon = entry.icon;
          const active = selected === key;
          return (
            <button
              key={key}
              type="button"
              title={entry.label}
              aria-label={entry.label}
              aria-pressed={active}
              onClick={() => setSelected(key)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
