"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  History,
  MapPin,
  Minus,
  MoreVertical,
  Move,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { ProductForm } from "@/components/stock/product-form";
import {
  adjustQuantityAction,
  deleteProductAction,
  moveStockAction,
  productHistoryAction,
  removeStockAction,
  setQuantityAction,
  updateStockAction,
} from "@/lib/actions/stock";
import { IDLE } from "@/lib/actions/types";
import type { Unit } from "@/lib/db/schema";
import { unitInfo } from "@/lib/units";
import { cn, formatDate, formatNumber, round3, timeAgo } from "@/lib/utils";

export type StockCardItem = {
  id: string;
  quantity: number;
  minQuantity: number | null;
  expiresAt: string | null;
  note: string | null;
  compartmentId: string;
  total: number;
  locations: number;
  product: {
    id: string;
    name: string;
    unit: Unit;
    step: number;
    minQuantity: number;
    notes: string | null;
  };
};

export type CompartmentOption = {
  id: string;
  name: string;
  furnitureName: string;
  sectorName: string;
};

const KIND_LABEL: Record<string, string> = {
  ALTA: "Alta",
  CONSUMO: "Consumo",
  REPOSICION: "Reposición",
  AJUSTE: "Ajuste",
  TRASLADO: "Traslado",
};

/** Milisegundos que esperamos antes de mandar los toques al servidor. */
const FLUSH_DELAY = 700;

export function StockCard({
  item,
  canDelete,
  compartments,
  showLocation,
}: {
  item: StockCardItem;
  canDelete: boolean;
  compartments: CompartmentOption[];
  /** En listas globales conviene aclarar de qué mueble es cada tarjeta. */
  showLocation?: string;
}) {
  const router = useRouter();
  const { notify } = useToast();

  const [quantity, setQuantity] = useState(item.quantity);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [editProductOpen, setEditProductOpen] = useState(false);
  const [editPlaceOpen, setEditPlaceOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const pendingRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const info = unitInfo(item.product.unit);
  // El total de la casa se mueve junto con lo que toco acá.
  const houseTotal = round3(item.total - item.quantity + quantity);

  const missingHere =
    item.minQuantity !== null &&
    item.minQuantity > 0 &&
    quantity <= item.minQuantity;
  const missingInHouse =
    item.product.minQuantity > 0 && houseTotal <= item.product.minQuantity;
  const empty = quantity <= 0;

  useEffect(() => {
    if (pendingRef.current === 0) setQuantity(item.quantity);
  }, [item.quantity]);

  async function flush() {
    const delta = pendingRef.current;
    pendingRef.current = 0;
    if (delta === 0) return;

    setSaving(true);
    const result = await adjustQuantityAction(item.id, delta);
    setSaving(false);

    if (result.ok && typeof result.quantity === "number") {
      if (pendingRef.current === 0) setQuantity(result.quantity);
      router.refresh();
    } else {
      setQuantity(item.quantity);
      notify(result.error ?? "No pudimos guardar el cambio.", "error");
    }
  }

  function bump(delta: number) {
    setQuantity((current) => Math.max(0, round3(current + delta)));
    pendingRef.current = round3(pendingRef.current + delta);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, FLUSH_DELAY);
  }

  // Si el usuario se va de la página, mandamos lo que quedó pendiente.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingRef.current !== 0) void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={cn(
        "rounded-2xl border bg-surface p-3 transition-colors",
        missingInHouse
          ? "border-danger/40 bg-danger-soft/30"
          : missingHere
            ? "border-warning/40 bg-warning-soft/40"
            : "border-border",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/productos/${item.product.id}`}
              className="font-medium leading-tight hover:text-primary hover:underline"
            >
              {item.product.name}
            </Link>
            {missingInHouse ? (
              <Badge tone="danger">
                <ShoppingCart className="size-3" />
                Comprar
              </Badge>
            ) : null}
            {missingHere ? (
              <Badge tone="warning">
                <TriangleAlert className="size-3" />
                Traer acá
              </Badge>
            ) : empty ? (
              <Badge>Vacío acá</Badge>
            ) : null}
          </div>

          <p className="mt-0.5 text-xs text-muted">
            {item.locations > 1 ? (
              <>
                {formatNumber(houseTotal)} {info.short} en la casa, repartido en{" "}
                {item.locations} lugares
              </>
            ) : item.product.minQuantity > 0 ? (
              <>
                Avisar bajo {formatNumber(item.product.minQuantity)} {info.short}{" "}
                en la casa
              </>
            ) : (
              <>Se mide en {info.label.toLowerCase()}</>
            )}
            {item.expiresAt ? ` · vence ${formatDate(item.expiresAt)}` : ""}
          </p>

          {showLocation ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <MapPin className="size-3" />
              {showLocation}
            </p>
          ) : null}

          {item.note ?? item.product.notes ? (
            <p className="mt-1 text-xs italic text-muted">
              {item.note ?? item.product.notes}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={`Opciones de ${item.product.name}`}
          className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <MoreVertical className="size-4.5" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => bump(-item.product.step)}
          disabled={quantity <= 0}
          aria-label={`Descontar ${formatNumber(item.product.step)} ${info.short} de ${item.product.name}`}
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-foreground transition-colors hover:bg-border/70 active:scale-95 disabled:opacity-40"
        >
          <Minus className="size-5" />
        </button>

        <button
          type="button"
          onClick={() => setAdjustOpen(true)}
          aria-label={`Ajustar la cantidad de ${item.product.name}`}
          className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-3 transition-colors hover:bg-border/60"
        >
          <span className="text-xl font-semibold leading-none tabular-nums">
            {formatNumber(quantity)}
          </span>
          <span className="text-sm text-muted">{info.short}</span>
          {saving ? (
            <span className="ml-1 size-1.5 animate-pulse rounded-full bg-primary" />
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => bump(item.product.step)}
          aria-label={`Agregar ${formatNumber(item.product.step)} ${info.short} a ${item.product.name}`}
          className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform hover:bg-primary/90 active:scale-95"
        >
          <Plus className="size-5" />
        </button>
      </div>

      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title={item.product.name}
        description={`Acá hay ${formatNumber(quantity)} ${info.short}`}
        size="sm"
      >
        <AdjustBody
          key={quantity}
          item={item}
          quantity={quantity}
          onQuantity={(value) => {
            setQuantity(value);
            router.refresh();
          }}
          onClose={() => setAdjustOpen(false)}
        />
      </Modal>

      <Modal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={item.product.name}
        size="sm"
      >
        <div className="space-y-1">
          <MenuItem
            icon={<Pencil className="size-4.5" />}
            label="Editar el producto"
            hint="Nombre, unidad y mínimo de la casa"
            onClick={() => {
              setMenuOpen(false);
              setEditProductOpen(true);
            }}
          />
          <MenuItem
            icon={<MapPin className="size-4.5" />}
            label="Ajustes de este lugar"
            hint="Aviso propio, vencimiento y nota"
            onClick={() => {
              setMenuOpen(false);
              setEditPlaceOpen(true);
            }}
          />
          <MenuItem
            icon={<Move className="size-4.5" />}
            label="Mover a otro lugar"
            onClick={() => {
              setMenuOpen(false);
              setMoveOpen(true);
            }}
          />
          <MenuItem
            icon={<History className="size-4.5" />}
            label="Ver historial"
            onClick={() => {
              setMenuOpen(false);
              setHistoryOpen(true);
            }}
          />

          {canDelete ? (
            <>
              <div className="my-2 border-t border-border" />
              <DangerItem
                label="Sacar de este lugar"
                description={`Deja de figurar acá, pero sigue en el catálogo${item.locations > 1 ? " y en los otros lugares" : ""}.`}
                confirmLabel="Sacar de acá"
                onConfirm={() => removeStockAction(item.id)}
                onDone={() => setMenuOpen(false)}
              />
              <DangerItem
                label="Eliminar de toda la casa"
                description="Se borra del catálogo, de todos los lugares y con todo su historial."
                confirmLabel="Eliminar del todo"
                onConfirm={() => deleteProductAction(item.product.id)}
                onDone={() => setMenuOpen(false)}
              />
            </>
          ) : (
            <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-muted">
              Sólo el administrador puede eliminar productos.
            </p>
          )}
        </div>
      </Modal>

      <ProductForm
        open={editProductOpen}
        onClose={() => setEditProductOpen(false)}
        product={item.product}
      />

      <PlaceSettingsModal
        open={editPlaceOpen}
        onClose={() => setEditPlaceOpen(false)}
        item={item}
      />

      <MoveModal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        item={item}
        quantity={quantity}
        compartments={compartments}
      />

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`Historial de ${item.product.name}`}
      >
        <HistoryBody product={item.product} />
      </Modal>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
    >
      <span className="text-muted">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </button>
  );
}

function DangerItem({
  label,
  description,
  confirmLabel,
  onConfirm,
  onDone,
}: {
  label: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<{ ok: boolean; error?: string; message?: string }>;
  onDone: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const { notify } = useToast();
  const router = useRouter();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-danger transition-colors hover:bg-danger-soft"
      >
        <Trash2 className="size-4.5" />
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-danger-soft p-3">
      <p className="text-sm text-danger">{description}</p>
      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </Button>
        <Button
          variant="danger"
          size="sm"
          className="flex-1"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await onConfirm();
              notify(
                result.ok
                  ? (result.message ?? "Listo.")
                  : (result.error ?? "Error"),
                result.ok ? "success" : "error",
              );
              if (result.ok) {
                onDone();
                router.refresh();
              }
            })
          }
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

function AdjustBody({
  item,
  quantity,
  onQuantity,
  onClose,
}: {
  item: StockCardItem;
  quantity: number;
  onQuantity: (value: number) => void;
  onClose: () => void;
}) {
  const info = unitInfo(item.product.unit);
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [exact, setExact] = useState(String(quantity));

  function apply(delta: number) {
    startTransition(async () => {
      const result = await adjustQuantityAction(item.id, delta);
      if (result.ok && typeof result.quantity === "number") {
        onQuantity(result.quantity);
      } else {
        notify(result.error ?? "No pudimos guardar el cambio.", "error");
      }
    });
  }

  function applyExact() {
    const value = Number(exact.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      notify("Escribí un número válido.", "error");
      return;
    }

    startTransition(async () => {
      const result = await setQuantityAction(item.id, value);
      if (result.ok && typeof result.quantity === "number") {
        onQuantity(result.quantity);
        onClose();
      } else {
        notify(result.error ?? "No pudimos guardar el cambio.", "error");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium">Descontar</p>
        <div className="grid grid-cols-4 gap-2">
          {info.quickSteps.map((amount) => (
            <button
              key={`minus-${amount}`}
              type="button"
              disabled={pending || quantity <= 0}
              onClick={() => apply(-amount)}
              className="rounded-xl border border-border bg-surface-2 py-2.5 text-sm font-semibold tabular-nums transition-colors hover:bg-border/70 disabled:opacity-40"
            >
              −{formatNumber(amount)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Agregar</p>
        <div className="grid grid-cols-4 gap-2">
          {info.quickSteps.map((amount) => (
            <button
              key={`plus-${amount}`}
              type="button"
              disabled={pending}
              onClick={() => apply(amount)}
              className="rounded-xl bg-primary-soft py-2.5 text-sm font-semibold tabular-nums text-primary transition-colors hover:bg-primary-soft/70 disabled:opacity-40"
            >
              +{formatNumber(amount)}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border p-3">
        <Field
          label="O poné la cantidad exacta"
          hint="Ideal cuando contás lo que hay de verdad."
        >
          <div className="flex gap-2">
            <Input
              value={exact}
              onChange={(event) => setExact(event.target.value)}
              inputMode="decimal"
              className="flex-1 text-center text-lg font-semibold tabular-nums"
            />
            <Button onClick={applyExact} loading={pending} className="px-4">
              <Check className="size-4" />
              Guardar
            </Button>
          </div>
        </Field>
      </div>
    </div>
  );
}

function PlaceSettingsModal({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item: StockCardItem;
}) {
  const info = unitInfo(item.product.unit);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajustes de este lugar"
      description="Valen sólo acá, no en los otros lugares donde esté el producto."
      size="sm"
    >
      <PlaceSettingsForm item={item} info={info.short} onClose={onClose} />
    </Modal>
  );
}

function PlaceSettingsForm({
  item,
  info,
  onClose,
}: {
  item: StockCardItem;
  info: string;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(updateStockAction, IDLE);
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
      <input type="hidden" name="id" value={item.id} />

      <Field
        label="Avisar si acá baja de"
        hint={`En ${info}. Vacío = sin aviso propio de este lugar.`}
      >
        <Input
          name="locationMin"
          inputMode="decimal"
          defaultValue={item.minQuantity ?? ""}
          className="tabular-nums"
        />
      </Field>

      <Field label="Vence el">
        <Input name="expiresAt" type="date" defaultValue={item.expiresAt ?? ""} />
      </Field>

      <Field label="Nota de este lugar">
        <Input
          name="note"
          defaultValue={item.note ?? ""}
          placeholder="Atrás de todo, en el cajón"
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
        <SubmitButton className="flex-1">Guardar</SubmitButton>
      </div>
    </form>
  );
}

function MoveModal({
  open,
  onClose,
  item,
  quantity,
  compartments,
}: {
  open: boolean;
  onClose: () => void;
  item: StockCardItem;
  quantity: number;
  compartments: CompartmentOption[];
}) {
  const info = unitInfo(item.product.unit);
  const options = compartments.filter((option) => option.id !== item.compartmentId);
  const [target, setTarget] = useState(options[0]?.id ?? "");
  const [amount, setAmount] = useState(String(quantity));
  const [pending, startTransition] = useTransition();
  const { notify } = useToast();
  const router = useRouter();

  function move() {
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      notify("Poné una cantidad mayor a cero.", "error");
      return;
    }

    startTransition(async () => {
      const result = await moveStockAction(item.id, target, value);
      notify(
        result.ok ? (result.message ?? "Listo.") : (result.error ?? "Error"),
        result.ok ? "success" : "error",
      );
      if (result.ok) {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Mover ${item.product.name}`}
      description={`Acá hay ${formatNumber(quantity)} ${info.short}`}
      size="sm"
    >
      {options.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          No hay otro compartimiento a dónde moverlo todavía.
        </p>
      ) : (
        <div className="space-y-4">
          <Field label={`¿Cuánto movés? (${info.short})`}>
            <Input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              className="text-center text-lg font-semibold tabular-nums"
            />
          </Field>

          <Field label="¿A dónde?">
            <Select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.sectorName} · {option.furnitureName} · {option.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button className="flex-1" loading={pending} onClick={move}>
              <Move className="size-4" />
              Mover
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function HistoryBody({ product }: { product: StockCardItem["product"] }) {
  const info = unitInfo(product.unit);
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof productHistoryAction>>["items"]
  >(undefined);

  useEffect(() => {
    let alive = true;

    productHistoryAction(product.id).then((result) => {
      if (alive) setItems(result.items ?? []);
    });

    return () => {
      alive = false;
    };
  }, [product.id]);

  if (items === undefined) {
    return <p className="py-6 text-center text-sm text-muted">Cargando…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        Todavía no hay movimientos registrados.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((entry) => (
        <li key={entry.id} className="flex items-center gap-3 py-2.5">
          <span
            className={cn(
              "w-16 shrink-0 text-right text-sm font-semibold tabular-nums",
              entry.delta > 0 ? "text-success" : "text-danger",
            )}
          >
            {entry.delta > 0 ? "+" : ""}
            {formatNumber(entry.delta)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">
              {KIND_LABEL[entry.kind] ?? entry.kind} · {entry.userName}
            </p>
            <p className="truncate text-xs text-muted">
              <CalendarClock className="mr-1 inline size-3" />
              {timeAgo(entry.createdAt)} · {entry.locationName} · quedó en{" "}
              {formatNumber(entry.resulting)} {info.short}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
