"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  startEmptyIntakeAction,
  startIntakeFromListAction,
} from "@/lib/actions/intake";

/**
 * Puerta de entrada a la carga en lote. Abre el borrador —con la lista adentro
 * o vacío— y lleva derecho a la pantalla de revisión.
 */
export function StartIntakeButton({
  mode,
  label,
  variant = "primary",
  size = "md",
}: {
  mode: "lista" | "vacia";
  label: string;
  variant?: "primary" | "soft" | "secondary";
  size?: "sm" | "md" | "lg";
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { notify } = useToast();

  function start() {
    startTransition(async () => {
      const result =
        mode === "lista"
          ? await startIntakeFromListAction()
          : await startEmptyIntakeAction();

      if (result.ok && result.batchId) {
        router.push(`/compras/cargar/${result.batchId}`);
        return;
      }

      notify(result.error ?? "No pudimos abrir la carga.", "error");
    });
  }

  return (
    <Button variant={variant} size={size} loading={pending} onClick={start}>
      <PackagePlus className="size-4" />
      {label}
    </Button>
  );
}
