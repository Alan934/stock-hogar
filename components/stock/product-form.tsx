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

type CompartmentOption = { id: string; name: string; furnitureName?: string };

type ProductValues = {
  id: string;
  name: string;
  unit: Unit;
  minQuantity: number;
  step: number;
  notes: string | null;
  expiresAt: string | null;
  compartmentId: string;
};

export function ProductForm({
  open,
  onClose,
  compartments,
  product,
  defaultCompartmentId,
}: {
  open: boolean;
  onClose: () => void;
  compartments: CompartmentOption[];
  product?: ProductValues;
  defaultCompartmentId?: string;
}) {
  const editing = Boolean(product);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Editar ${product?.name}` : "Agregar producto"}
      description={
        editing
          ? undefined
          : "Cargalo una vez y después lo sumás o descontás con los botones."
      }
    >
      <ProductFields
        onClose={onClose}
        compartments={compartments}
        product={product}
        defaultCompartmentId={defaultCompartmentId}
      />
    </Modal>
  );
}

function ProductFields({
  onClose,
  compartments,
  product,
  defaultCompartmentId,
}: {
  onClose: () => void;
  compartments: CompartmentOption[];
  product?: ProductValues;
  defaultCompartmentId?: string;
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
          autoFocus={!editing}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
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

        {editing ? (
          <Field label="Compartimiento">
            <Select
              name="compartmentId"
              defaultValue={product?.compartmentId ?? defaultCompartmentId}
            >
              {compartments.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.furnitureName
                    ? `${option.furnitureName} · ${option.name}`
                    : option.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Cantidad inicial">
            <Input
              name="quantity"
              inputMode="decimal"
              defaultValue="0"
              placeholder="0"
              className="tabular-nums"
            />
          </Field>
        )}
      </div>

      {!editing ? (
        <Field label="Compartimiento">
          <Select
            name="compartmentId"
            defaultValue={defaultCompartmentId ?? compartments[0]?.id}
            required
          >
            {compartments.map((option) => (
              <option key={option.id} value={option.id}>
                {option.furnitureName
                  ? `${option.furnitureName} · ${option.name}`
                  : option.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Avisar cuando baje de"
          hint={`En ${info.short}. Dejá 0 para no avisar.`}
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

      <Field label="Vence el" hint="Opcional.">
        <Input
          name="expiresAt"
          type="date"
          defaultValue={product?.expiresAt ?? ""}
        />
      </Field>

      <Field label="Nota" hint="Opcional. Marca, tamaño, para qué es…">
        <Textarea
          name="notes"
          defaultValue={product?.notes ?? ""}
          placeholder="Marca La Serenísima, sachet de 1 L"
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
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onClose}
        >
          Cancelar
        </Button>
        <SubmitButton className="flex-1">
          {editing ? "Guardar cambios" : "Agregar"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Botón + modal listos para usar dentro de un compartimiento. */
export function AddProductButton({
  compartments,
  defaultCompartmentId,
  label = "Agregar producto",
  variant = "soft",
  size = "sm",
  className,
}: {
  compartments: CompartmentOption[];
  defaultCompartmentId?: string;
  label?: string;
  variant?: "soft" | "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        {label}
      </Button>
      <ProductForm
        open={open}
        onClose={() => setOpen(false)}
        compartments={compartments}
        defaultCompartmentId={defaultCompartmentId}
      />
    </>
  );
}
