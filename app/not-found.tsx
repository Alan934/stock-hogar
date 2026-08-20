import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-muted">
        <Compass className="size-7" />
      </span>
      <div>
        <h1 className="text-xl font-semibold">No encontramos esta página</h1>
        <p className="mt-1 text-sm text-muted">
          Puede que el sector o el mueble hayan sido eliminados.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
