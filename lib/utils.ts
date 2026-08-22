import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Redondea a 3 decimales para no arrastrar errores de punto flotante. */
export function round3(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

const numberFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 3,
});

export function formatNumber(value: number) {
  return numberFormatter.format(round3(value));
}

/** Compara nombres sin distinguir mayúsculas, tildes ni espacios de más. */
export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Token corto, legible y difícil de adivinar para los códigos QR. */
export function createToken(length = 12) {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const relativeFormatter = new Intl.RelativeTimeFormat("es", {
  numeric: "auto",
});

export function timeAgo(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.round((value.getTime() - Date.now()) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4.348],
    ["month", 12],
    ["year", Number.POSITIVE_INFINITY],
  ];

  let amount = seconds;
  for (const [unit, size] of steps) {
    if (Math.abs(amount) < size) return relativeFormatter.format(Math.round(amount), unit);
    amount = amount / size;
  }
  return relativeFormatter.format(Math.round(amount), "year");
}

export function formatDate(date: Date | string | null) {
  if (!date) return null;
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}
