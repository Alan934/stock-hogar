import Link from "next/link";
import type { Metadata } from "next";
import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/ui/card";
import { ProductCard } from "@/components/stock/product-card";
import { SearchBox } from "./search-box";
import { requireFamilyUser } from "@/lib/auth";
import { getAllCompartments, searchProducts } from "@/lib/queries";

export const metadata: Metadata = { title: "Buscar" };

export default async function SearchPage({ searchParams }: PageProps<"/buscar">) {
  const user = await requireFamilyUser();
  const params = await searchParams;
  const raw = params?.q;
  const term = typeof raw === "string" ? raw : "";

  const [results, compartments] = await Promise.all([
    searchProducts(user.familyId, term),
    getAllCompartments(user.familyId),
  ]);

  const canDelete = user.role === "ADMIN";

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Buscar</h1>
        <SearchBox defaultValue={term} />
      </header>

      {!term.trim() ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          Escribí el nombre de un producto para encontrarlo sin importar en qué
          mueble esté.
        </p>
      ) : results.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-8" />}
          title={`No encontramos "${term}"`}
          description="Probá con otra palabra o revisá si está cargado con otro nombre."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {results.map((product) => (
            <div key={product.id} className="space-y-1">
              <ProductCard
                product={product}
                canDelete={canDelete}
                compartments={compartments}
              />
              <Link
                href={`/muebles/${product.furnitureId}`}
                className="block px-1 text-[11px] text-muted hover:text-primary hover:underline"
              >
                {product.sectorName} · {product.furnitureName} ·{" "}
                {product.compartmentName}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
