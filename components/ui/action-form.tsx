"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { IDLE, type ActionState } from "@/lib/actions/types";

type ServerFormAction = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/**
 * Modal con formulario conectado a una server action. Cierra solo cuando la
 * acción termina bien, avisa con un toast y refresca la página.
 */
export function ActionFormModal({
  open,
  onClose,
  title,
  description,
  action,
  submitLabel = "Guardar",
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  action: ServerFormAction;
  submitLabel?: string;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
    >
      {/* Se monta recién al abrir, así cada vez arranca con el formulario limpio. */}
      <ActionForm action={action} onClose={onClose} submitLabel={submitLabel}>
        {children}
      </ActionForm>
    </Modal>
  );
}

function ActionForm({
  action,
  onClose,
  submitLabel,
  children,
}: {
  action: ServerFormAction;
  onClose: () => void;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const handled = useRef(state);
  const router = useRouter();
  const { notify } = useToast();

  useEffect(() => {
    if (state === handled.current || !state.ok) return;
    handled.current = state;

    notify(state.message ?? "Listo.", "success");
    onClose();
    router.refresh();
  }, [state, notify, onClose, router]);

  return (
    <form action={formAction} className="space-y-4">
      {children}

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onClose}
        >
          Cancelar
        </Button>
        <SubmitButton className="flex-1">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
