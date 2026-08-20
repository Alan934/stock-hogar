import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  CalendarClock,
  MapPin,
  ShoppingCart,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductHeaderActions } from "./actions";
import { StockCard } from "@/components/stock/stock-card";
import { requireFamilyUser } from "@/lib/auth";
import { getAllCompartments, getProductDetail } from "@/lib/queries";
import { unitInfo } from "@/lib/units";
import { formatNumber, timeAgo } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  ALTA: "Alta",
  CONSUMO: "Consumo",
  REPOSICION: "Reposición",
  AJUSTE: "Ajuste",
  TRASLADO: "Traslado",
};

export async function generateMetadata({
  params,
}: PageProps<"/productos/[id]">): Promise<Metadata> {
  const user = await requireFamilyUser();
  const { id } = await params;
  const detail = await getProductDetail(user.familyId, id);
  return { title: detail?.product.name ?? "Producto" };
}

export default async function ProductPage({ params }: PageProps<"/productos/[id]">) {
  const user = await requireFamilyUser();
  const { id } = await params;

  const detail = await getProductDetail(user.familyId, id);
  if (!detail) notFound();

  const { product, locations, history } = detail;
  const compartments = await getAllCompartments(user.familyId);
  const info = unitInfo(product.unit);
  const canDelete = user.role === "ADMIN";
  const missing = product.minQuantity > 0 && product.total <= product.minQuantity;

  return (
    <div className="space-y-6">
      <Link
        href="/productos"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Productos
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {product.name}
            </h1>
            {missing ? (
              <Badge tone="danger">
                <ShoppingCart className="size-3" />
                Comprar
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {formatNumber(product.total)} {info.short}
            </span>{" "}
            en la casa
            {locations.length > 0
              ? `, repartido en ${locations.length} ${locations.length === 1 ? "lugar" : "lugares"}`
              : ", todavía sin guardar en ningún lado"}
            {product.minQuantity > 0
              ? ` · avisar bajo ${formatNumber(product.minQuantity)} ${info.short}`
              : ""}
          </p>
          {product.notes ? (
            <p className="mt-1 text-sm italic text-muted">{product.notes}</p>
          ) : null}
        </div>

        <ProductHeaderActions
          product={{
            id: product.id,
            name: product.name,
            unit: product.unit,
            step: product.step,
            minQuantity: product.minQuantity,
            notes: product.notes,
          }}
          canDelete={canDelete}
        />
      </header>

      <section className="space-y-3">
        <h2 className="font-semibold">Dónde está</h2>

        {locations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            Este producto todavía no está guardado en ningún mueble. Entrá a un
            compartimiento y elegilo con el botón «Producto».
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {locations.map((location) => (
              <StockCard
                key={location.id}
                item={{
                  id: location.id,
                  quantity: location.quantity,
                  minQuantity: location.minQuantity,
                  expiresAt: location.expiresAt,
                  note: location.note,
                  compartmentId: location.compartmentId,
                  total: product.total,
                  locations: locations.length,
                  product: {
                    id: product.id,
                    name: product.name,
                    unit: product.unit,
                    step: product.step,
                    minQuantity: product.minQuantity,
                    notes: product.notes,
                  },
                }}
                canDelete={canDelete}
                compartments={compartments}
                showLocation={`${location.sectorName} · ${location.furnitureName} · ${location.compartmentName}`}
              />
            ))}
          </div>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4.5 text-muted" />
            Historial
          </CardTitle>
        </CardHeader>
        <CardBody className="pt-3">
          {history.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              Todavía no hay movimientos registrados.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className={`w-16 shrink-0 text-right text-sm font-semibold tabular-nums ${
                      entry.delta > 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {entry.delta > 0 ? "+" : ""}
                    {formatNumber(entry.delta)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {KIND_LABEL[entry.kind] ?? entry.kind} · {entry.userName}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                    <p className="truncate text-xs text-muted">
                      <MapPin className="mr-1 inline size-3" />
                      {entry.locationName} · {timeAgo(entry.createdAt)} · quedó en{" "}
                      {formatNumber(entry.resulting)} {info.short}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {locations.some(
        (location) =>
          location.minQuantity !== null &&
          location.minQuantity > 0 &&
          location.quantity <= location.minQuantity,
      ) ? (
        <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2.5 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Alguno de los lugares está por debajo de su propio mínimo. Si en la casa
          hay de sobra, alcanza con acercarlo desde otro lugar.
        </p>
      ) : null}
    </div>
  );
}
