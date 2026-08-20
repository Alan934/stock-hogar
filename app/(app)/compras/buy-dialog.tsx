"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBasket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { addStockAction } from "@/lib/actions/stock";
import { IDLE } from "@/lib/actions/types";
import type { Unit } from "@/lib/db/schema";
import { unitShort } from "@/lib/units";
import { formatNumber } from "@/lib/utils";

type BuyProduct = {
  id: string;
  name: string;
  unit: Unit;
  suggested: number;
};

type CompartmentOption = {
  id: string;
  name: string;
  furnitureName: string;
  sectorName: string;
};

/**
 * Cierra el círculo de la lista: compraste algo, decís cuánto y dónde lo
 * guardaste, y deja de faltar.
 */
export function BuyButton({
  product,
  compartments,
  defaultCompartmentId,
}: {
  product: BuyProduct;
  compartments: CompartmentOption[];
  defaultCompartmentId?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="soft" size="sm" onClick={() => setOpen(true)}>
        <ShoppingBasket className="size-4" />
        Ya lo compré
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Guardar ${product.name}`}
        description="Decinos cuánto compraste y dónde lo dejaste."
        size="sm"
      >
        <BuyForm
          product={product}
          compartments={compartments}
          defaultCompartmentId={defaultCompartmentId}
          onClose={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function BuyForm({
  product,
  compartments,
  defaultCompartmentId,
  onClose,
}: {
  product: BuyProduct;
  compartments: CompartmentOption[];
  defaultCompartmentId?: string;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(addStockAction, IDLE);
  const handled = useRef(state);
  const router = useRouter();
  const { notify } = useToast();

  useEffect(() => {
    if (state === handled.current || !state.ok) return;
    handled.current = state;

    notify(state.message ?? "Guardado.", "success");
    onClose();
    router.refresh();
  }, [state, notify, onClose, router]);

  if (compartments.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        Todavía no hay ningún compartimiento donde guardarlo. Creá un mueble
        primero.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="productId" value={product.id} />

      <Field label={`¿Cuánto compraste? (${unitShort(product.unit)})`}>
        <Input
          name="quantity"
          inputMode="decimal"
          defaultValue={formatNumber(product.suggested)}
          autoFocus
          required
          className="text-center text-lg font-semibold tabular-nums"
        />
      </Field>

      <Field label="¿Dónde lo guardaste?">
        <Select
          name="compartmentId"
          defaultValue={defaultCompartmentId ?? compartments[0]?.id}
          required
        >
          {compartments.map((option) => (
            <option key={option.id} value={option.id}>
              {option.sectorName} · {option.furnitureName} · {option.name}
            </option>
          ))}
        </Select>
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
        <SubmitButton className="flex-1">Guardar</SubmitButton>
      </div>
    </form>
  );
}
