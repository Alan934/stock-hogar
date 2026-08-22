import Link from "next/link";
import type { Metadata } from "next";
import { PackagePlus, PartyPopper, ShoppingCart, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BuyButton } from "./buy-dialog";
import { CopyListButton, ManualList } from "./manual-list";
import { StartIntakeButton } from "./start-intake";
import { requireFamilyUser } from "@/lib/auth";
import {
  getAllCompartments,
  getOpenIntakeBatch,
  getPlacesForProducts,
  getRefillList,
  getShoppingItems,
  getShoppingList,
} from "@/lib/queries";
import { unitShort } from "@/lib/units";
import { formatNumber, round3, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Lista de compras" };

export default async function ShoppingPage() {
  const user = await requireFamilyUser();

  const [missing, refill, manual, compartments, openBatch] = await Promise.all([
    getShoppingList(user.familyId, 100),
    getRefillList(user.familyId, 50),
    getShoppingItems(user.familyId),
    getAllCompartments(user.familyId),
    getOpenIntakeBatch(user.familyId),
  ]);

  const places = await getPlacesForProducts(
    user.familyId,
    missing.map((product) => product.id),
  );

  /** Cuánto conviene comprar para volver a estar por encima del mínimo. */
  const suggested = (product: (typeof missing)[number]) =>
    round3(Math.max(product.minQuantity - product.total, product.step));

  const pending = manual.filter((item) => !item.done);

  const textToCopy = [
    ...missing.map(
      (product) =>
        `${product.name} (faltan ${formatNumber(suggested(product))} ${unitShort(product.unit)})`,
    ),
    ...pending.map((item) => item.label),
  ].join("\n");

  const nothingToDo =
    missing.length === 0 && refill.length === 0 && manual.length === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Lista de compras
          </h1>
          <p className="text-sm text-muted">
            Lo que falta en casa, más lo que anote cualquiera de la familia.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {textToCopy ? <CopyListButton text={textToCopy} /> : null}
          <StartIntakeButton mode="lista" label="Cargar la compra" />
        </div>
      </header>

      {openBatch ? (
        <Card className="flex flex-wrap items-center gap-3 border-primary/40 bg-primary-soft/25 p-4">
          <PackagePlus className="size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Hay una carga a medio revisar</p>
            <p className="text-xs text-muted">
              {openBatch.lineCount}{" "}
              {openBatch.lineCount === 1 ? "producto" : "productos"} · la empezó{" "}
              {openBatch.createdByName} {timeAgo(openBatch.createdAt)}
            </p>
          </div>
          <Link href={`/compras/cargar/${openBatch.id}`}>
            <Button variant="soft">Seguir cargando</Button>
          </Link>
        </Card>
      ) : null}

      {nothingToDo ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <PartyPopper className="size-8 text-primary" />
          <div className="space-y-1">
            <p className="font-medium">No falta nada</p>
            <p className="mx-auto max-w-sm text-sm text-muted">
              Ningún producto está por debajo de su mínimo. Si querés que algo
              aparezca acá, ponele un mínimo desde su ficha.
            </p>
          </div>
          <StartIntakeButton
            mode="vacia"
            variant="soft"
            label="Cargar una compra igual"
          />
        </div>
      ) : null}

      {missing.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-4.5 text-danger" />
            <h2 className="font-semibold">Falta en la casa</h2>
            <Badge tone="danger">{missing.length}</Badge>
          </div>

          <Card>
            <ul className="divide-y divide-border">
              {missing.map((product) => (
                <li
                  key={product.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/productos/${product.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {product.name}
                    </Link>
                    <p className="text-xs text-muted">
                      Hay {formatNumber(product.total)}{" "}
                      {unitShort(product.unit)} · el mínimo es{" "}
                      {formatNumber(product.minQuantity)} · comprá al menos{" "}
                      <strong className="text-foreground">
                        {formatNumber(suggested(product))}{" "}
                        {unitShort(product.unit)}
                      </strong>
                    </p>
                  </div>
                  <BuyButton
                    product={{
                      id: product.id,
                      name: product.name,
                      unit: product.unit,
                      suggested: suggested(product),
                    }}
                    compartments={compartments}
                    defaultCompartmentId={places.get(product.id)}
                  />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {refill.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="size-4.5 text-warning" />
            <h2 className="font-semibold">No hace falta comprar</h2>
            <Badge tone="warning">{refill.length}</Badge>
          </div>
          <p className="text-sm text-muted">
            De esto hay en casa, sólo está faltando donde se usa. Alcanza con
            acercarlo desde el otro lugar.
          </p>

          <Card>
            <ul className="divide-y divide-border">
              {refill.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <Link
                    href={`/productos/${item.product.id}`}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {item.product.name}
                  </Link>
                  <p className="text-xs text-muted">
                    Quedan {formatNumber(item.quantity)}{" "}
                    {unitShort(item.product.unit)} en {item.sectorName} ·{" "}
                    {item.furnitureName} · {item.compartmentName}, de{" "}
                    {formatNumber(item.total)} {unitShort(item.product.unit)} en
                    toda la casa
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <ManualList items={manual} />
    </div>
  );
}
