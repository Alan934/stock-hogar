import Link from "next/link";
import type { Metadata } from "next";
import { ScanLine } from "lucide-react";

import { EmptyState } from "@/components/ui/card";

export const metadata: Metadata = { title: "Código QR desconocido" };

export default function UnknownQrPage() {
  return (
    <EmptyState
      icon={<ScanLine className="size-8" />}
      title="Ese código QR no corresponde a ningún mueble tuyo"
      description="Puede ser de otra familia o de un mueble que ya fue eliminado. Si lo acaban de regenerar, imprimí el código nuevo."
      action={
        <Link
          href="/qr"
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver mis códigos QR
        </Link>
      }
    />
  );
}
