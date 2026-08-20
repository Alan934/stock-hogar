import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, PackageOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";
import {
  CompartmentMenu,
  FurnitureMenu,
  NewCompartmentButton,
} from "@/components/stock/furniture-dialogs";
import { ProductCard } from "@/components/stock/product-card";
import { AddProductButton } from "@/components/stock/product-form";
import { QrButton } from "@/components/stock/qr";
import { requireFamilyUser } from "@/lib/auth";
import { getAllCompartments, getFurnitureDetail } from "@/lib/queries";

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

  const allCompartments = await getAllCompartments(user.familyId);
  const canDelete = user.role === "ADMIN";

  const totalProducts = furniture.compartments.reduce(
    (total, compartment) => total + compartment.products.length,
    0,
  );
  const lowCount = furniture.compartments.reduce(
    (total, compartment) =>
      total +
      compartment.products.filter(
        (product) =>
          product.minQuantity > 0 && product.quantity <= product.minQuantity,
      ).length,
    0,
  );

  return (
    <div className="space-y-6">
      <Link
        href={`/sectores/${furniture.sectorId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {furniture.sector.name}
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {furniture.name}
            </h1>
            <p className="text-sm text-muted">
              {totalProducts} {totalProducts === 1 ? "producto" : "productos"} en{" "}
              {furniture.compartments.length}{" "}
              {furniture.compartments.length === 1
                ? "compartimiento"
                : "compartimientos"}
              {lowCount > 0 ? ` · ${lowCount} para reponer` : ""}
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
            isAdmin={user.role === "ADMIN"}
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
            const compartmentLow = compartment.products.filter(
              (product) =>
                product.minQuantity > 0 &&
                product.quantity <= product.minQuantity,
            ).length;

            return (
              <section key={compartment.id} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <h2 className="font-semibold">{compartment.name}</h2>
                  <span className="text-sm text-muted">
                    {compartment.products.length}
                  </span>
                  {compartmentLow > 0 ? (
                    <Badge tone="warning">{compartmentLow} a reponer</Badge>
                  ) : null}
                  <div className="ml-auto flex items-center gap-1">
                    <AddProductButton
                      compartments={allCompartments}
                      defaultCompartmentId={compartment.id}
                      label="Producto"
                    />
                    <CompartmentMenu
                      compartment={compartment}
                      canDelete={canDelete}
                    />
                  </div>
                </div>

                {compartment.products.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
                    Todavía no hay nada guardado acá.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {compartment.products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        canDelete={canDelete}
                        compartments={allCompartments}
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
