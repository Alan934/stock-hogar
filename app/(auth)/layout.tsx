import { ThemeToggle } from "@/components/theme";

// La app siempre depende de la sesión: nunca se prerenderiza en el build.
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/12 to-transparent"
      />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  );
}
