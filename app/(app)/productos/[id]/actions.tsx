"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { ProductForm, type ProductValues } from "@/components/stock/product-form";
import { deleteProductAction } from "@/lib/actions/stock";

export function ProductHeaderActions({
  product,
  canDelete,
}: {
  product: ProductValues;
  canDelete: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={() => setEditOpen(true)}>
        <Pencil className="size-4" />
        Editar
      </Button>

      {canDelete ? (
        <ConfirmAction
          onConfirm={() => deleteProductAction(product.id)}
          onSuccess={() => router.push("/productos")}
          title={`Eliminar ${product.name}`}
          description="Se borra del catálogo, de todos los lugares donde esté guardado y con todo su historial."
          confirmLabel="Eliminar del todo"
          trigger={(open) => (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Eliminar ${product.name}`}
              onClick={open}
              className="hover:text-danger"
            >
              <Trash2 className="size-4.5" />
            </Button>
          )}
        />
      ) : null}

      <ProductForm
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          router.refresh();
        }}
        product={product}
      />
    </div>
  );
}
