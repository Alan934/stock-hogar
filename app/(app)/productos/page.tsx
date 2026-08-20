import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, PackageSearch, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { NewProductButton } from "@/components/stock/product-form";
import { requireFamilyUser } from "@/lib/auth";
import { getCatalog } from "@/lib/queries";
import { unitShort } from "@/lib/units";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Productos" };

export default async function CatalogPage() {
  const user = await requireFamilyUser();
  const catalog = await getCatalog(user.familyId);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="text-sm text-muted">
            El catálogo de la casa. Cada uno se escribe una vez y después se
            guarda en los muebles que haga falta.
          </p>
        </div>
        <NewProductButton />
      </header>

      {catalog.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="size-8" />}
          title="El catálogo está vacío"
          description="Podés crear productos desde acá, o directamente al guardarlos en un mueble."
        />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {catalog.map((product) => {
              const missing =
                product.minQuantity > 0 && product.total <= product.minQuantity;

              return (
                <li key={product.id}>
                  <Link
                    href={`/productos/${product.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        <span className="truncate">{product.name}</span>
                        {missing ? (
                          <Badge tone="danger">
                            <ShoppingCart className="size-3" />
                            Comprar
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted">
                        {product.locations === 0
                          ? "Sin guardar en ningún lugar"
                          : `${product.locations} ${product.locations === 1 ? "lugar" : "lugares"}`}
                        {product.minQuantity > 0
                          ? ` · avisar bajo ${formatNumber(product.minQuantity)} ${unitShort(product.unit)}`
                          : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-right">
                      <span className="block text-lg font-semibold tabular-nums">
                        {formatNumber(product.total)}
                      </span>
                      <span className="block text-xs text-muted">
                        {unitShort(product.unit)}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
