import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, PackageOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";
import { AddStockButton } from "@/components/stock/add-stock";
import {
  CompartmentMenu,
  FurnitureMenu,
  NewCompartmentButton,
} from "@/components/stock/furniture-dialogs";
import { QrButton } from "@/components/stock/qr";
import { StockCard } from "@/components/stock/stock-card";
import { requireFamilyUser } from "@/lib/auth";
import { getAllCompartments, getCatalog, getFurnitureDetail } from "@/lib/queries";

export async function generateMetadata({
  params,
}: PageProps<"/muebles/[id]">): Promise<Metadata> {
  const user = await requireFamilyUser();
  const { id } = await params;
  const furniture = await getFurnitureDetail(user.familyId, id);
  return { title: furniture?.name ?? "Mueble" };
}

export default async function FurniturePage({ params }: PageProps<"/muebles/[id]">) {
  const user = await requireFamilyUser();
  const { id } = await params;

  const furniture = await getFurnitureDetail(user.familyId, id);
  if (!furniture) notFound();

  const [catalog, compartmentOptions] = await Promise.all([
    getCatalog(user.familyId),
    getAllCompartments(user.familyId),
  ]);

  const canDelete = user.role === "ADMIN";

  const allItems = furniture.compartments.flatMap((compartment) => compartment.items);
  const attention = allItems.filter(
    (item) =>
      (item.minQuantity !== null &&
        item.minQuantity > 0 &&
        item.quantity <= item.minQuantity) ||
      (item.product.minQuantity > 0 && item.total <= item.product.minQuantity),
  ).length;

  return (
    <div className="space-y-6">
      <Link
        href={`/sectores/${furniture.sectorId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {furniture.sectorName}
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {furniture.name}
            </h1>
            <p className="text-sm text-muted">
              {allItems.length} {allItems.length === 1 ? "producto" : "productos"}{" "}
              en {furniture.compartments.length}{" "}
              {furniture.compartments.length === 1
                ? "compartimiento"
                : "compartimientos"}
              {attention > 0 ? ` · ${attention} para revisar` : ""}
            </p>
          </div>
          <FurnitureMenu furniture={furniture} canDelete={canDelete} />
        </div>

        <div className="flex flex-wrap gap-2">
          <QrButton
            furniture={{
              id: furniture.id,
              name: furniture.name,
              qrToken: furniture.qrToken,
            }}
            isAdmin={canDelete}
          />
          <NewCompartmentButton furnitureId={furniture.id} />
        </div>
      </header>

      {furniture.compartments.length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="size-8" />}
          title="Este mueble no tiene compartimientos"
          description="Creá al menos uno (por ejemplo Freezer y Heladera) para poder guardar productos."
        />
      ) : (
        <div className="space-y-7">
          {furniture.compartments.map((compartment) => {
            const compartmentAttention = compartment.items.filter(
              (item) =>
                item.minQuantity !== null &&
                item.minQuantity > 0 &&
                item.quantity <= item.minQuantity,
            ).length;

            return (
              <section key={compartment.id} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <h2 className="font-semibold">{compartment.name}</h2>
                  <span className="text-sm text-muted">
                    {compartment.items.length}
                  </span>
                  {compartmentAttention > 0 ? (
                    <Badge tone="warning">{compartmentAttention} a reponer</Badge>
                  ) : null}
                  <div className="ml-auto flex items-center gap-1">
                    <AddStockButton
                      catalog={catalog}
                      compartmentId={compartment.id}
                      compartmentName={compartment.name}
                    />
                    <CompartmentMenu
                      compartment={compartment}
                      canDelete={canDelete}
                    />
                  </div>
                </div>

                {compartment.items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
                    Todavía no hay nada guardado acá.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {compartment.items.map((item) => (
                      <StockCard
                        key={item.id}
                        item={item}
                        canDelete={canDelete}
                        compartments={compartmentOptions}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
