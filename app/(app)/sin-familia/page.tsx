import Link from "next/link";
import type { Metadata } from "next";
import { Users } from "lucide-react";

import { EmptyState } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sin familia asignada" };

export default async function NoFamilyPage() {
  const user = await requireUser();

  return (
    <EmptyState
      icon={<Users className="size-8" />}
      title="Todavía no estás en ninguna familia"
      description="El administrador tiene que asignarte a una para que veas el stock de la casa."
      action={
        user.role === "ADMIN" ? (
          <Link
            href="/admin"
            className="text-sm font-medium text-primary hover:underline"
          >
            Ir al panel de administración
          </Link>
        ) : (
          <Link
            href="/cuenta"
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver mi cuenta
          </Link>
        )
      }
    />
  );
}
