"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  History,
  Minus,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ProductForm } from "@/components/stock/product-form";
import {
  adjustQuantityAction,
  deleteProductAction,
  productHistoryAction,
  setQuantityAction,
} from "@/lib/actions/stock";
import type { Unit } from "@/lib/db/schema";
import { unitInfo } from "@/lib/units";
import { cn, formatDate, formatNumber, round3, timeAgo } from "@/lib/utils";

export type ProductCardData = {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  minQuantity: number;
  step: number;
  notes: string | null;
  expiresAt: string | null;
  compartmentId: string;
};

type CompartmentOption = { id: string; name: string; furnitureName?: string };

const KIND_LABEL: Record<string, string> = {
  ALTA: "Alta",
  CONSUMO: "Consumo",
  REPOSICION: "Reposición",
  AJUSTE: "Ajuste",
};

/** Milisegundos que esperamos antes de mandar los toques al servidor. */
const FLUSH_DELAY = 700;

export function ProductCard({
  product,
  canDelete,
  compartments,
}: {
  product: ProductCardData;
  canDelete: boolean;
  compartments: CompartmentOption[];
}) {
  const router = useRouter();
  const { notify } = useToast();

  const [quantity, setQuantity] = useState(product.quantity);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const pendingRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const info = unitInfo(product.unit);
  const low = product.minQuantity > 0 && quantity <= product.minQuantity;
  const empty = quantity <= 0;

  // Mientras no haya toques pendientes, seguimos lo que dice el servidor.
  useEffect(() => {
    if (pendingRef.current === 0) setQuantity(product.quantity);
  }, [product.quantity]);

  async function flush() {
    const delta = pendingRef.current;
    pendingRef.current = 0;
    if (delta === 0) return;

    setSaving(true);
    const result = await adjustQuantityAction(product.id, delta);
    setSaving(false);

    if (result.ok && typeof result.quantity === "number") {
      if (pendingRef.current === 0) setQuantity(result.quantity);
      router.refresh();
    } else {
      setQuantity(product.quantity);
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
        low ? "border-warning/40 bg-warning-soft/40" : "border-border",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-medium leading-tight">{product.name}</h3>
            {empty ? (
              <Badge tone="danger">Sin stock</Badge>
            ) : low ? (
              <Badge tone="warning">
                <TriangleAlert className="size-3" />
                Reponer
              </Badge>
            ) : null}
          </div>

          <p className="mt-0.5 text-xs text-muted">
            {product.minQuantity > 0
              ? `Avisar cuando baje de ${formatNumber(product.minQuantity)} ${info.short}`
              : `Se mide en ${info.label.toLowerCase()}`}
            {product.expiresAt
              ? ` · vence ${formatDate(product.expiresAt)}`
              : ""}
          </p>

          {product.notes ? (
            <p className="mt-1 text-xs text-muted italic">{product.notes}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={`Opciones de ${product.name}`}
          className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <MoreVertical className="size-4.5" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => bump(-product.step)}
          disabled={quantity <= 0}
          aria-label={`Descontar ${formatNumber(product.step)} ${info.short} de ${product.name}`}
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-foreground transition-colors hover:bg-border/70 active:scale-95 disabled:opacity-40"
        >
          <Minus className="size-5" />
        </button>

        <button
          type="button"
          onClick={() => setAdjustOpen(true)}
          aria-label={`Ajustar la cantidad de ${product.name}`}
          className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-3 transition-colors hover:bg-border/60"
        >
          <span className="text-xl font-semibold tabular-nums leading-none">
            {formatNumber(quantity)}
          </span>
          <span className="text-sm text-muted">{info.short}</span>
          {saving ? (
            <span className="ml-1 size-1.5 animate-pulse rounded-full bg-primary" />
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => bump(product.step)}
          aria-label={`Agregar ${formatNumber(product.step)} ${info.short} a ${product.name}`}
          className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform hover:bg-primary/90 active:scale-95"
        >
          <Plus className="size-5" />
        </button>
      </div>

      <AdjustDialog
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        product={product}
        quantity={quantity}
        onQuantity={(value) => {
          setQuantity(value);
          router.refresh();
        }}
      />

      <Modal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={product.name}
        size="sm"
      >
        <div className="space-y-1">
          <MenuItem
            icon={<Pencil className="size-4.5" />}
            label="Editar producto"
            onClick={() => {
              setMenuOpen(false);
              setEditOpen(true);
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
            <DeleteItem
              product={product}
              onDone={() => {
                setMenuOpen(false);
                router.refresh();
              }}
            />
          ) : (
            <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-muted">
              Sólo el administrador puede eliminar productos.
            </p>
          )}
        </div>
      </Modal>

      <ProductForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        compartments={compartments}
        product={product}
      />

      <HistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        product={product}
      />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-surface-2",
        danger ? "text-danger hover:bg-danger-soft" : "text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function DeleteItem({
  product,
  onDone,
}: {
  product: ProductCardData;
  onDone: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const { notify } = useToast();

  if (!confirming) {
    return (
      <MenuItem
        icon={<Trash2 className="size-4.5" />}
        label="Eliminar producto"
        danger
        onClick={() => setConfirming(true)}
      />
    );
  }

  return (
    <div className="rounded-xl bg-danger-soft p-3">
      <p className="text-sm text-danger">
        ¿Eliminar <strong>{product.name}</strong> y todo su historial?
      </p>
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
              const result = await deleteProductAction(product.id);
              notify(
                result.ok
                  ? (result.message ?? "Eliminado.")
                  : (result.error ?? "Error"),
                result.ok ? "success" : "error",
              );
              if (result.ok) onDone();
            })
          }
        >
          Sí, eliminar
        </Button>
      </div>
    </div>
  );
}

function AdjustDialog({
  open,
  onClose,
  product,
  quantity,
  onQuantity,
}: {
  open: boolean;
  onClose: () => void;
  product: ProductCardData;
  quantity: number;
  onQuantity: (value: number) => void;
}) {
  const info = unitInfo(product.unit);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product.name}
      description={`Ahora hay ${formatNumber(quantity)} ${info.short}`}
      size="sm"
    >
      {/* La key remonta el cuerpo cada vez que cambia la cantidad, así el campo
          de "cantidad exacta" nunca queda con un número viejo. */}
      <AdjustBody
        key={quantity}
        product={product}
        quantity={quantity}
        onQuantity={onQuantity}
        onClose={onClose}
      />
    </Modal>
  );
}

function AdjustBody({
  product,
  quantity,
  onQuantity,
  onClose,
}: {
  product: ProductCardData;
  quantity: number;
  onQuantity: (value: number) => void;
  onClose: () => void;
}) {
  const info = unitInfo(product.unit);
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [exact, setExact] = useState(String(quantity));

  function apply(delta: number) {
    startTransition(async () => {
      const result = await adjustQuantityAction(product.id, delta);
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
      const result = await setQuantityAction(product.id, value);
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

function HistoryDialog({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product: ProductCardData;
}) {
  return (
    <Modal open={open} onClose={onClose} title={`Historial de ${product.name}`}>
      {/* Se monta al abrir, así siempre trae los movimientos frescos. */}
      <HistoryBody product={product} />
    </Modal>
  );
}

function HistoryBody({ product }: { product: ProductCardData }) {
  const info = unitInfo(product.unit);
  const [items, setItems] =
    useState<Awaited<ReturnType<typeof productHistoryAction>>["items"]>(
      undefined,
    );

  useEffect(() => {
    let alive = true;

    productHistoryAction(product.id).then((result) => {
      if (alive) setItems(result.items ?? []);
    });

    return () => {
      alive = false;
    };
  }, [product.id]);

  return (
    <>
      {items === undefined ? (
        <p className="py-6 text-center text-sm text-muted">Cargando…</p>
      ) : !items?.length ? (
        <p className="py-6 text-center text-sm text-muted">
          Todavía no hay movimientos registrados.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <span
                className={cn(
                  "w-16 shrink-0 text-right text-sm font-semibold tabular-nums",
                  item.delta > 0 ? "text-success" : "text-danger",
                )}
              >
                {item.delta > 0 ? "+" : ""}
                {formatNumber(item.delta)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {KIND_LABEL[item.kind] ?? item.kind} · {item.userName}
                </p>
                <p className="text-xs text-muted">
                  <CalendarClock className="mr-1 inline size-3" />
                  {timeAgo(item.createdAt)} · quedó en{" "}
                  {formatNumber(item.resulting)} {info.short}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
