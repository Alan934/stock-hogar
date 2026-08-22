"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  MapPin,
  Minus,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  addIntakeLineAction,
  confirmIntakeBatchAction,
  createProductForIntakeAction,
  discardIntakeBatchAction,
  removeIntakeLineAction,
  updateIntakeLineAction,
} from "@/lib/actions/intake";
import type { Unit } from "@/lib/db/schema";
import { UNITS, unitInfo } from "@/lib/units";
import { cn, formatNumber, normalizeText, round3 } from "@/lib/utils";

export type ReviewLine = {
  id: string;
  productId: string | null;
  rawLabel: string;
  quantity: number;
  compartmentId: string | null;
  skipped: boolean;
  productName: string | null;
  productUnit: Unit | null;
  productStep: number | null;
  /** Cuánto hay hoy en toda la casa, antes de sumar esta compra. */
  total: number;
};

export type CompartmentOption = {
  id: string;
  name: string;
  furnitureName: string;
  sectorName: string;
};

export type CatalogOption = {
  id: string;
  name: string;
  unit: Unit;
  step: number;
  total: number;
};

/** Lo que se toca en la tabla se manda al servidor tras un ratito de calma. */
const SAVE_DELAY = 600;

type Line = ReviewLine & {
  /** Texto crudo del input: deja escribir "1," sin romper la cantidad. */
  quantityText: string;
};

type LinePatch = {
  quantity?: number;
  compartmentId?: string | null;
  skipped?: boolean;
  productId?: string;
};

function toLine(line: ReviewLine): Line {
  return { ...line, quantityText: formatNumber(line.quantity) };
}

function parseQuantity(text: string) {
  const value = Number(text.replace(",", ".").trim());
  return Number.isFinite(value) && value >= 0 ? round3(value) : null;
}

/** Un renglón está listo cuando ya no hay nada que preguntar. */
function isReady(line: Line) {
  return Boolean(line.productId && line.compartmentId && line.quantity > 0);
}

export function IntakeReview({
  batchId,
  initialLines,
  catalog,
  compartments,
}: {
  batchId: string;
  initialLines: ReviewLine[];
  catalog: CatalogOption[];
  compartments: CompartmentOption[];
}) {
  const router = useRouter();
  const { notify } = useToast();

  const [lines, setLines] = useState(() => initialLines.map(toLine));
  const [picker, setPicker] = useState<{
    lineId: string | null;
    defaultName: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const pending = useRef(new Map<string, LinePatch>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const updateLocal = useCallback((id: string, patch: Partial<Line>) => {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }, []);

  /** Manda lo que haya pendiente de este renglón y limpia su temporizador. */
  const flush = useCallback(
    async (id: string) => {
      const timer = timers.current.get(id);
      if (timer) clearTimeout(timer);
      timers.current.delete(id);

      const patch = pending.current.get(id);
      pending.current.delete(id);
      if (!patch) return;

      const result = await updateIntakeLineAction(id, patch);
      if (!result.ok) {
        notify(result.error ?? "No pudimos guardar el cambio.", "error");
        router.refresh();
      }
    },
    [notify, router],
  );

  const scheduleSave = useCallback(
    (id: string, patch: LinePatch, delay = SAVE_DELAY) => {
      pending.current.set(id, { ...pending.current.get(id), ...patch });

      const timer = timers.current.get(id);
      if (timer) clearTimeout(timer);
      timers.current.set(
        id,
        setTimeout(() => void flush(id), delay),
      );
    },
    [flush],
  );

  const flushAll = useCallback(async () => {
    await Promise.all([...pending.current.keys()].map((id) => flush(id)));
  }, [flush]);

  // Si alguien se va de la pantalla, lo último que tocó no se pierde.
  useEffect(() => {
    const timersRef = timers.current;
    return () => {
      for (const timer of timersRef.values()) clearTimeout(timer);
      void flushAll();
    };
  }, [flushAll]);

  function changeQuantity(line: Line, text: string) {
    const value = parseQuantity(text);
    updateLocal(line.id, {
      quantityText: text,
      quantity: value ?? line.quantity,
    });
    if (value !== null) scheduleSave(line.id, { quantity: value });
  }

  function bump(line: Line, delta: number) {
    const value = Math.max(0, round3(line.quantity + delta));
    updateLocal(line.id, { quantity: value, quantityText: formatNumber(value) });
    scheduleSave(line.id, { quantity: value });
  }

  function changeCompartment(line: Line, compartmentId: string) {
    updateLocal(line.id, { compartmentId: compartmentId || null });
    scheduleSave(line.id, { compartmentId: compartmentId || null }, 0);
  }

  function toggleSkip(line: Line) {
    updateLocal(line.id, { skipped: !line.skipped });
    scheduleSave(line.id, { skipped: !line.skipped }, 0);
  }

  async function removeLine(line: Line) {
    setLines((current) => current.filter((item) => item.id !== line.id));
    pending.current.delete(line.id);

    const result = await removeIntakeLineAction(line.id);
    if (!result.ok) {
      notify(result.error ?? "No pudimos sacar el renglón.", "error");
      router.refresh();
    }
  }

  /** Elegiste un producto del catálogo: agrega un renglón o resuelve el que estaba. */
  async function pickProduct(product: CatalogOption) {
    const target = picker;
    setPicker(null);
    if (!target) return;

    if (target.lineId) {
      updateLocal(target.lineId, {
        productId: product.id,
        productName: product.name,
        productUnit: product.unit,
        productStep: product.step,
        total: product.total,
      });
      scheduleSave(target.lineId, { productId: product.id }, 0);
      return;
    }

    setBusy(true);
    const result = await addIntakeLineAction(batchId, product.id);
    setBusy(false);

    if (!result.ok || !result.line) {
      notify(result.error ?? "No pudimos agregarlo.", "error");
      return;
    }

    setLines((current) => [
      ...current,
      toLine({ ...result.line!, skipped: false }),
    ]);
  }

  /** Compraste algo que no estaba en el catálogo: se da de alta en el momento. */
  async function createProduct(name: string, unit: Unit) {
    const target = picker;
    if (!target) return;

    setBusy(true);
    const result = await createProductForIntakeAction(
      batchId,
      target.lineId,
      name,
      unit,
    );
    setBusy(false);

    if (!result.ok || !result.line) {
      notify(result.error ?? "No pudimos crear el producto.", "error");
      return;
    }

    const line = result.line;
    setPicker(null);

    setLines((current) =>
      target.lineId
        ? current.map((item) =>
            item.id === target.lineId
              ? toLine({ ...item, ...line, skipped: item.skipped })
              : item,
          )
        : [...current, toLine({ ...line, skipped: false })],
    );
  }

  const active = lines.filter((line) => !line.skipped);
  const ready = active.filter(isReady);
  const incomplete = active.length - ready.length;

  /** Antes de cerrar mandamos lo que quedó tecleado sin guardar. */
  async function confirm() {
    await flushAll();
    return confirmIntakeBatchAction(batchId);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="soft"
          onClick={() => setPicker({ lineId: null, defaultName: "" })}
        >
          <Plus className="size-4" />
          Agregar producto
        </Button>

        <ConfirmAction
          onConfirm={() => discardIntakeBatchAction(batchId)}
          onSuccess={() => router.push("/compras")}
          title="Descartar esta carga"
          description="Se tira el borrador entero. El stock queda exactamente como está ahora."
          confirmLabel="Descartar"
          trigger={(open) => (
            <Button variant="ghost" onClick={open}>
              <Undo2 className="size-4" />
              Descartar
            </Button>
          )}
        />
      </div>

      {lines.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-8" />}
          title="La carga está vacía"
          description="Agregá lo que compraste. Después revisás cantidades y lugares todo junto, y se guarda de una."
          action={
            <Button onClick={() => setPicker({ lineId: null, defaultName: "" })}>
              <Plus className="size-4" />
              Agregar producto
            </Button>
          }
        />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {lines.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                compartments={compartments}
                onQuantityText={(text) => changeQuantity(line, text)}
                onBump={(delta) => bump(line, delta)}
                onCompartment={(value) => changeCompartment(line, value)}
                onToggleSkip={() => toggleSkip(line)}
                onRemove={() => removeLine(line)}
                onIdentify={() =>
                  setPicker({ lineId: line.id, defaultName: line.rawLabel })
                }
              />
            ))}
          </ul>
        </Card>
      )}

      {lines.length > 0 ? (
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 md:bottom-4">
          <Card className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {ready.length} {ready.length === 1 ? "producto listo" : "productos listos"}
              </p>
              <p className="text-xs text-muted">
                {incomplete > 0
                  ? `${incomplete} ${incomplete === 1 ? "renglón" : "renglones"} sin lugar, sin producto o en cero`
                  : "Nada pendiente: se guarda todo de una."}
              </p>
            </div>
            <ConfirmAction
              onConfirm={confirm}
              onSuccess={() => router.push("/compras")}
              title={`Guardar ${ready.length} ${ready.length === 1 ? "producto" : "productos"}`}
              description="Se suma todo al stock de una sola vez y queda registrado en el historial. Después de esto la carga se cierra."
              confirmLabel="Guardar todo"
              tone="primary"
              trigger={(open) => (
                <Button
                  onClick={open}
                  disabled={ready.length === 0 || incomplete > 0}
                >
                  <Check className="size-4" />
                  Guardar todo
                </Button>
              )}
            />
          </Card>
        </div>
      ) : null}

      {/* Se monta recién al abrirlo: el buscador arranca limpio cada vez. */}
      {picker ? (
        <ProductPicker
          onClose={() => setPicker(null)}
          catalog={catalog}
          defaultName={picker.defaultName}
          resolving={Boolean(picker.lineId)}
          busy={busy}
          onPick={pickProduct}
          onCreate={createProduct}
        />
      ) : null}
    </div>
  );
}

function LineRow({
  line,
  compartments,
  onQuantityText,
  onBump,
  onCompartment,
  onToggleSkip,
  onRemove,
  onIdentify,
}: {
  line: Line;
  compartments: CompartmentOption[];
  onQuantityText: (text: string) => void;
  onBump: (delta: number) => void;
  onCompartment: (value: string) => void;
  onToggleSkip: () => void;
  onRemove: () => void;
  onIdentify: () => void;
}) {
  const info = line.productUnit ? unitInfo(line.productUnit) : null;
  const step = line.productStep ?? 1;
  const needsProduct = !line.productId;
  const needsPlace = !line.compartmentId;

  return (
    <li
      className={cn(
        "px-3 py-3 transition-colors sm:px-4",
        line.skipped && "opacity-50",
        !line.skipped && needsProduct && "bg-danger-soft/25",
        !line.skipped && !needsProduct && needsPlace && "bg-warning-soft/30",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p
              className={cn(
                "font-medium leading-tight",
                line.skipped && "line-through",
              )}
            >
              {line.productName ?? (line.rawLabel || "Sin identificar")}
            </p>
            {needsProduct ? (
              <Badge tone="danger">
                <TriangleAlert className="size-3" />
                Sin identificar
              </Badge>
            ) : null}
          </div>

          <p className="mt-0.5 text-xs text-muted">
            {needsProduct ? (
              "Decinos qué es para poder guardarlo."
            ) : (
              <>
                Hay {formatNumber(line.total)} {info?.short} en la casa · queda en{" "}
                {formatNumber(round3(line.total + line.quantity))} {info?.short}
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleSkip}
          title={line.skipped ? "Volver a incluirlo" : "No lo compré"}
          aria-label={line.skipped ? "Volver a incluirlo" : "No lo compré"}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          {line.skipped ? <Undo2 className="size-4" /> : <Minus className="size-4" />}
        </button>

        <button
          type="button"
          onClick={onRemove}
          title="Sacar de la carga"
          aria-label={`Sacar ${line.productName ?? line.rawLabel} de la carga`}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {line.skipped ? null : (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {needsProduct ? (
            <Button variant="soft" size="sm" onClick={onIdentify}>
              <Search className="size-4" />
              Identificar
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onBump(-step)}
                disabled={line.quantity <= 0}
                aria-label={`Restar ${formatNumber(step)} ${info?.short}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 transition-colors hover:bg-border/70 active:scale-95 disabled:opacity-40"
              >
                <Minus className="size-4" />
              </button>
              <div className="relative">
                <Input
                  value={line.quantityText}
                  onChange={(event) => onQuantityText(event.target.value)}
                  inputMode="decimal"
                  aria-label={`Cantidad de ${line.productName}`}
                  className="w-24 py-1.5 pr-9 text-center font-semibold tabular-nums"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">
                  {info?.short}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onBump(step)}
                aria-label={`Sumar ${formatNumber(step)} ${info?.short}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 transition-colors hover:bg-border/70 active:scale-95"
              >
                <Plus className="size-4" />
              </button>
            </div>
          )}

          <div className="relative min-w-48 flex-1">
            <MapPin
              className={cn(
                "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2",
                needsPlace ? "text-warning" : "text-muted",
              )}
            />
            <Select
              value={line.compartmentId ?? ""}
              onChange={(event) => onCompartment(event.target.value)}
              aria-label="Dónde lo guardo"
              className={cn(
                "py-1.5 pl-9 text-sm",
                needsPlace && "border-warning/60",
              )}
            >
              <option value="">¿Dónde lo guardo?</option>
              {compartments.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.sectorName} · {option.furnitureName} · {option.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * Buscador del catálogo. Sirve para las dos puntas: agregar algo al lote y
 * ponerle nombre a un renglón que llegó sin identificar.
 */
function ProductPicker({
  onClose,
  catalog,
  defaultName,
  resolving,
  busy,
  onPick,
  onCreate,
}: {
  onClose: () => void;
  catalog: CatalogOption[];
  defaultName: string;
  resolving: boolean;
  busy: boolean;
  onPick: (product: CatalogOption) => void;
  onCreate: (name: string, unit: Unit) => void;
}) {
  const [query, setQuery] = useState(defaultName);
  const [creating, setCreating] = useState(false);
  const [unit, setUnit] = useState<Unit>("UNIDAD");

  const matches = useMemo(() => {
    const term = normalizeText(query);
    if (!term) return catalog;
    return catalog.filter((item) => normalizeText(item.name).includes(term));
  }, [catalog, query]);

  const exact = matches.some(
    (item) => normalizeText(item.name) === normalizeText(query),
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={resolving ? "¿Qué es este producto?" : "Agregar a la carga"}
      description={
        resolving
          ? "Elegilo del catálogo o crealo si es la primera vez que lo comprás."
          : "Buscá en el catálogo. Lo que no exista se crea acá mismo."
      }
    >
      {creating ? (
        <div className="space-y-4">
          <Field label="Nombre">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Queso cremoso"
              autoFocus
            />
          </Field>

          <Field
            label="Se mide en"
            hint="El resto de la ficha (mínimo, notas) se completa después."
          >
            <Select
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

          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setCreating(false)}
            >
              Volver
            </Button>
            <Button
              className="flex-1"
              loading={busy}
              disabled={!query.trim()}
              onClick={() => onCreate(query, unit)}
            >
              Crear y agregar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscá en el catálogo…"
              aria-label="Buscar producto en el catálogo"
              autoFocus
              className="w-full rounded-xl border border-input bg-surface py-2.5 pl-11 pr-3 text-[15px] placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>

          {matches.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
              Nada con ese nombre en el catálogo.
            </p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {matches.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onPick(item)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-xs text-muted">
                        {formatNumber(item.total)} {unitInfo(item.unit).short} en
                        la casa
                      </p>
                    </div>
                    <Plus className="size-4 shrink-0 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {exact ? null : (
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
                  {query.trim()
                    ? `Crear "${query.trim()}"`
                    : "Crear un producto nuevo"}
                </span>
                <span className="block text-xs text-muted">
                  Queda en el catálogo para la próxima compra
                </span>
              </span>
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
