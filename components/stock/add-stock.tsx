"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Plus, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { addStockAction, createProductAction } from "@/lib/actions/stock";
import { IDLE, type ActionState } from "@/lib/actions/types";
import type { Unit } from "@/lib/db/schema";
import { UNITS, unitInfo } from "@/lib/units";
import { formatNumber } from "@/lib/utils";

export type CatalogOption = {
  id: string;
  name: string;
  unit: Unit;
  step: number;
  minQuantity: number;
  notes: string | null;
  total: number;
  locations: number;
};

/** Compara sin distinguir mayúsculas ni tildes. */
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function AddStockButton({
  catalog,
  compartmentId,
  compartmentName,
  label = "Producto",
  variant = "soft",
  size = "sm",
  className,
}: {
  catalog: CatalogOption[];
  compartmentId: string;
  compartmentName: string;
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Guardar en ${compartmentName}`}
      >
        {/* Se monta al abrir: el buscador arranca siempre limpio. */}
        <AddStockFlow
          catalog={catalog}
          compartmentId={compartmentId}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function AddStockFlow({
  catalog,
  compartmentId,
  onDone,
}: {
  catalog: CatalogOption[];
  compartmentId: string;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CatalogOption | null>(null);
  const [creating, setCreating] = useState(false);

  const matches = useMemo(() => {
    const term = normalize(query);
    if (!term) return catalog;
    return catalog.filter((item) => normalize(item.name).includes(term));
  }, [catalog, query]);

  const exactMatch = matches.some(
    (item) => normalize(item.name) === normalize(query),
  );

  if (selected) {
    return (
      <QuantityStep
        product={selected}
        compartmentId={compartmentId}
        onBack={() => setSelected(null)}
        onDone={onDone}
      />
    );
  }

  if (creating) {
    return (
      <NewProductStep
        defaultName={query.trim()}
        compartmentId={compartmentId}
        onBack={() => setCreating(false)}
        onDone={onDone}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscá en lo que ya cargaste…"
          aria-label="Buscar producto en el catálogo"
          autoFocus
          className="w-full rounded-xl border border-input bg-surface py-2.5 pl-11 pr-3 text-[15px] placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
      </div>

      {catalog.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          Todavía no cargaste ningún producto. Creá el primero acá abajo.
        </p>
      ) : matches.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          Nada con ese nombre en el catálogo.
        </p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {matches.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelected(item)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-xs text-muted">
                    Se mide en {unitInfo(item.unit).label.toLowerCase()}
                    {item.locations > 0
                      ? ` · ${formatNumber(item.total)} ${unitInfo(item.unit).short} en ${item.locations} ${item.locations === 1 ? "lugar" : "lugares"}`
                      : " · todavía no está guardado en ningún lado"}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!exactMatch ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border px-3 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary-soft/40"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Sparkles className="size-4.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {query.trim() ? `Crear "${query.trim()}"` : "Crear un producto nuevo"}
            </span>
            <span className="block text-xs text-muted">
              Las medidas se escriben una sola vez
            </span>
          </span>
        </button>
      ) : null}
    </div>
  );
}

/** Efecto compartido: cierra y refresca cuando la acción salió bien. */
function useActionDone(state: ActionState, onDone: () => void) {
  const handled = useRef(state);
  const router = useRouter();
  const { notify } = useToast();

  useEffect(() => {
    if (state === handled.current || !state.ok) return;
    handled.current = state;

    notify(state.message ?? "Listo.", "success");
    onDone();
    router.refresh();
  }, [state, notify, onDone, router]);
}

function ErrorMessage({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
    >
      {error}
    </p>
  );
}

function BackButton({ onBack, children }: { onBack: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {children}
    </button>
  );
}

/** Paso 2 con un producto ya existente: lo único obligatorio es la cantidad. */
function QuantityStep({
  product,
  compartmentId,
  onBack,
  onDone,
}: {
  product: CatalogOption;
  compartmentId: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(addStockAction, IDLE);
  const [advanced, setAdvanced] = useState(false);
  const info = unitInfo(product.unit);

  useActionDone(state, onDone);

  return (
    <form action={formAction} className="space-y-4">
      <BackButton onBack={onBack}>Elegir otro producto</BackButton>

      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="compartmentId" value={compartmentId} />

      <div className="rounded-xl bg-surface-2 px-3 py-2.5">
        <p className="font-medium">{product.name}</p>
        <p className="text-xs text-muted">
          {product.locations > 0
            ? `Ya hay ${formatNumber(product.total)} ${info.short} en la casa`
            : "Todavía no está guardado en ningún lado"}
        </p>
      </div>

      <Field label={`¿Cuánto guardás acá? (${info.short})`}>
        <Input
          name="quantity"
          inputMode="decimal"
          defaultValue={formatNumber(product.step)}
          autoFocus
          required
          className="text-center text-lg font-semibold tabular-nums"
        />
      </Field>

      {advanced ? (
        <div className="space-y-4 rounded-xl border border-border p-3">
          <Field
            label="Avisar si en este lugar baja de"
            hint={`En ${info.short}. Dejalo vacío si no querés aviso propio de este lugar.`}
          >
            <Input name="locationMin" inputMode="decimal" className="tabular-nums" />
          </Field>
          <Field label="Vence el">
            <Input name="expiresAt" type="date" />
          </Field>
          <Field label="Nota de este lugar">
            <Input name="note" placeholder="Atrás de todo, en el cajón" />
          </Field>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdvanced(true)}
          className="text-sm font-medium text-primary hover:underline"
        >
          Vencimiento, nota y aviso propio de este lugar
        </button>
      )}

      <ErrorMessage error={state.error} />

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="secondary" className="flex-1" onClick={onBack}>
          Volver
        </Button>
        <SubmitButton className="flex-1">Guardar acá</SubmitButton>
      </div>
    </form>
  );
}

/** Paso 2 alternativo: el producto no existe y hay que darle de alta. */
function NewProductStep({
  defaultName,
  compartmentId,
  onBack,
  onDone,
}: {
  defaultName: string;
  compartmentId: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(createProductAction, IDLE);
  const [unit, setUnit] = useState<Unit>("UNIDAD");
  const [advanced, setAdvanced] = useState(false);
  const info = unitInfo(unit);

  useActionDone(state, onDone);

  return (
    <form action={formAction} className="space-y-4">
      <BackButton onBack={onBack}>Buscar en el catálogo</BackButton>

      <input type="hidden" name="compartmentId" value={compartmentId} />

      <Field label="Nombre">
        <Input
          name="name"
          defaultValue={defaultName}
          placeholder="Queso cremoso"
          required
          autoFocus={!defaultName}
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

        <Field label={`Cantidad acá (${info.short})`}>
          <Input
            name="quantity"
            inputMode="decimal"
            defaultValue="1"
            autoFocus={Boolean(defaultName)}
            className="tabular-nums"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Avisar si en la casa baja de"
          hint={`Total en ${info.short}. 0 = no avisar.`}
        >
          <Input
            name="minQuantity"
            inputMode="decimal"
            defaultValue="0"
            className="tabular-nums"
          />
        </Field>

        <Field label="Cada toque de + / −" hint={`Suma o resta en ${info.short}.`}>
          <Input
            key={`step-${unit}`}
            name="step"
            inputMode="decimal"
            defaultValue={info.defaultStep}
            className="tabular-nums"
          />
        </Field>
      </div>

      {advanced ? (
        <div className="space-y-4 rounded-xl border border-border p-3">
          <Field label="Nota del producto" hint="Marca, tamaño, para qué es…">
            <Textarea name="notes" placeholder="Marca Sobrero" />
          </Field>
          <Field
            label="Avisar si en este lugar baja de"
            hint={`En ${info.short}. Es aparte del aviso de la casa.`}
          >
            <Input name="locationMin" inputMode="decimal" className="tabular-nums" />
          </Field>
          <Field label="Vence el">
            <Input name="expiresAt" type="date" />
          </Field>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdvanced(true)}
          className="text-sm font-medium text-primary hover:underline"
        >
          Nota, vencimiento y aviso propio de este lugar
        </button>
      )}

      <ErrorMessage error={state.error} />

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="secondary" className="flex-1" onClick={onBack}>
          Volver
        </Button>
        <SubmitButton className="flex-1">Crear y guardar</SubmitButton>
      </div>
    </form>
  );
}
