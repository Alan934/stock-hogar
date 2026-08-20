"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { createProductAction, updateProductAction } from "@/lib/actions/stock";
import { IDLE } from "@/lib/actions/types";
import type { Unit } from "@/lib/db/schema";
import { UNITS, unitInfo } from "@/lib/units";

export type ProductValues = {
  id: string;
  name: string;
  unit: Unit;
  step: number;
  minQuantity: number;
  notes: string | null;
};

/**
 * Datos del catálogo: valen para todos los lugares donde esté el producto.
 * Lo que es propio de un lugar (vencimiento, nota, aviso local) se edita en la
 * tarjeta de esa existencia.
 */
export function ProductForm({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product?: ProductValues;
}) {
  const editing = Boolean(product);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Editar ${product?.name}` : "Nuevo producto"}
      description={
        editing
          ? "Estos datos se aplican en todos los lugares donde esté guardado."
          : "Queda en el catálogo listo para guardarlo en cualquier mueble."
      }
    >
      <ProductFields product={product} onClose={onClose} />
    </Modal>
  );
}

function ProductFields({
  product,
  onClose,
}: {
  product?: ProductValues;
  onClose: () => void;
}) {
  const editing = Boolean(product);
  const router = useRouter();
  const { notify } = useToast();

  const [state, formAction] = useActionState(
    editing ? updateProductAction : createProductAction,
    IDLE,
  );
  const [unit, setUnit] = useState<Unit>(product?.unit ?? "UNIDAD");
  const handled = useRef(state);

  useEffect(() => {
    if (state === handled.current || !state.ok) return;
    handled.current = state;

    notify(state.message ?? "Guardado.", "success");
    onClose();
    router.refresh();
  }, [state, notify, onClose, router]);

  const info = unitInfo(unit);

  return (
    <form action={formAction} className="space-y-4">
      {editing ? <input type="hidden" name="id" value={product?.id} /> : null}

      <Field label="Nombre">
        <Input
          name="name"
          defaultValue={product?.name}
          placeholder="Queso cremoso"
          required
          autoFocus
        />
      </Field>

      <Field label="Se mide en">
        <Select
          name="unit"
          value={unit}
          onChange={(event) => setUnit(event.target.value as Unit)}
        >
          {UNITS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Avisar si en la casa baja de"
          hint={`Suma de todos los lugares, en ${info.short}. 0 = no avisar.`}
        >
          <Input
            name="minQuantity"
            inputMode="decimal"
            defaultValue={product?.minQuantity ?? 0}
            className="tabular-nums"
          />
        </Field>

        <Field label="Cada toque de + / −" hint={`Suma o resta en ${info.short}.`}>
          <Input
            key={`step-${unit}`}
            name="step"
            inputMode="decimal"
            defaultValue={product?.step ?? info.defaultStep}
            className="tabular-nums"
          />
        </Field>
      </div>

      <Field label="Nota" hint="Opcional. Marca, tamaño, para qué es…">
        <Textarea
          name="notes"
          defaultValue={product?.notes ?? ""}
          placeholder="Marca Sobrero"
        />
      </Field>

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
          Cancelar
        </Button>
        <SubmitButton className="flex-1">
          {editing ? "Guardar cambios" : "Crear producto"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Alta de catálogo suelta, sin guardarlo todavía en ningún mueble. */
export function NewProductButton({
  variant = "primary",
  size = "md",
}: {
  variant?: "primary" | "soft" | "secondary";
  size?: "sm" | "md" | "lg";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nuevo producto
      </Button>
      <ProductForm open={open} onClose={() => setOpen(false)} />
    </>
  );
}
