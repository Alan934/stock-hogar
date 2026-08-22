"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/actions/types";

/**
 * Botón que pide confirmación antes de ejecutar una acción destructiva.
 * Se usa para todo lo que sólo puede hacer el administrador.
 */
export function ConfirmAction({
  onConfirm,
  onSuccess,
  title,
  description,
  confirmLabel = "Eliminar",
  tone = "danger",
  trigger,
}: {
  onConfirm: () => Promise<ActionState>;
  /** Si se pasa, corre en lugar del refresco (por ejemplo para navegar). */
  onSuccess?: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  /** Para lo que no destruye nada pero conviene confirmar igual. */
  tone?: "danger" | "primary";
  trigger: (open: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { notify } = useToast();
  const router = useRouter();

  function run() {
    startTransition(async () => {
      const result = await onConfirm();
      if (result.ok) {
        notify(result.message ?? "Listo.", "success");
        setOpen(false);
        if (onSuccess) onSuccess();
        else router.refresh();
      } else {
        notify(result.error ?? "No se pudo completar.", "error");
      }
    });
  }

  return (
    <>
      {trigger(() => setOpen(true))}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        size="sm"
      >
        <p className="text-sm text-muted">{description}</p>
        <div className="mt-5 flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            variant={tone}
            className="flex-1"
            loading={pending}
            onClick={run}
          >
            {confirmLabel}
          </Button>
        </div>
      </Modal>
    </>
  );
}
