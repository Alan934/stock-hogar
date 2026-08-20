import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  ChevronRight,
  PackageSearch,
  ShoppingCart,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, EmptyState } from "@/components/ui/card";
import { SectorIcon } from "@/components/stock/sector-icon";
import { StockCard } from "@/components/stock/stock-card";
import { requireFamilyUser } from "@/lib/auth";
import {
  getAllCompartments,
  getFamilyStats,
  getRecentMovements,
  getRefillList,
  getSectorsWithStats,
  getShoppingList,
} from "@/lib/queries";
import { formatNumber, timeAgo } from "@/lib/utils";
import { unitShort } from "@/lib/units";

export default async function DashboardPage() {
  const user = await requireFamilyUser();

  const [stats, sectorList, shopping, refill, compartments, activity] =
    await Promise.all([
      getFamilyStats(user.familyId),
      getSectorsWithStats(user.familyId),
      getShoppingList(user.familyId, 8),
      getRefillList(user.familyId, 6),
      getAllCompartments(user.familyId),
      getRecentMovements(user.familyId, 8),
    ]);

  const canDelete = user.role === "ADMIN";

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hola, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted">
            Esto es lo que hay en casa ahora mismo.
          </p>
        </div>
        <Link
          href="/productos"
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Ver el catálogo
          <ArrowRight className="size-4" />
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sectores" value={stats.sectorCount} />
        <Stat label="Muebles" value={stats.furnitureCount} />
        <Stat label="Productos" value={stats.productCount} />
        <Stat label="Para comprar" value={stats.buyCount} tone="danger" />
      </div>

      {shopping.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-4.5 text-danger" />
            <h2 className="font-semibold">Falta en la casa</h2>
            <Badge tone="danger">{stats.buyCount}</Badge>
            <Link
              href="/compras"
              className="ml-auto flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Lista de compras
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <Card>
            <ul className="divide-y divide-border">
              {shopping.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/productos/${product.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="text-xs text-muted">
                        Quedan {formatNumber(product.total)}{" "}
                        {unitShort(product.unit)} · el mínimo es{" "}
                        {formatNumber(product.minQuantity)}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {refill.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-4.5 text-warning" />
            <h2 className="font-semibold">Falta en su lugar</h2>
            <Badge tone="warning">{stats.refillCount}</Badge>
          </div>
          <p className="text-sm text-muted">
            Hay en la casa, pero no donde se usa: convendría acercarlo.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {refill.map((item) => (
              <StockCard
                key={item.id}
                item={item}
                canDelete={canDelete}
                compartments={compartments}
                showLocation={`${item.sectorName} · ${item.furnitureName} · ${item.compartmentName}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Sectores</h2>
          <Link
            href="/sectores"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Ver todos
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {sectorList.length === 0 ? (
          <EmptyState
            icon={<Boxes className="size-8" />}
            title="Todavía no hay sectores"
            description="Empezá creando la cocina, el baño o el lavadero. Después le agregás los muebles."
            action={
              <Link
                href="/sectores"
                className="text-sm font-medium text-primary hover:underline"
              >
                Crear el primer sector
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sectorList.map((sector) => (
              <Link key={sector.id} href={`/sectores/${sector.id}`}>
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardBody className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <SectorIcon name={sector.icon} className="size-5.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{sector.name}</p>
                      <p className="text-xs text-muted">
                        {sector.furnitureCount}{" "}
                        {sector.furnitureCount === 1 ? "mueble" : "muebles"} ·{" "}
                        {sector.productCount}{" "}
                        {sector.productCount === 1 ? "producto" : "productos"}
                      </p>
                    </div>
                    {sector.lowCount > 0 ? (
                      <Badge tone="warning">{sector.lowCount}</Badge>
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted" />
                    )}
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {activity.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-semibold">Últimos movimientos</h2>
          <Card>
            <ul className="divide-y divide-border">
              {activity.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/productos/${item.productId}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                  >
                    <span
                      className={`w-14 shrink-0 text-right text-sm font-semibold tabular-nums ${
                        item.delta > 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {item.delta > 0 ? "+" : ""}
                      {formatNumber(item.delta)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.productName}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {item.userName} · {item.locationName} ·{" "}
                        {timeAgo(item.createdAt)} · quedó en{" "}
                        {formatNumber(item.resulting)} {unitShort(item.unit)}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : stats.productCount === 0 && sectorList.length > 0 ? (
        <EmptyState
          icon={<PackageSearch className="size-8" />}
          title="Todavía no cargaste productos"
          description="Entrá a un mueble y agregá lo que tengas guardado ahí."
        />
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "danger";
}) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-0.5 text-2xl font-semibold tabular-nums ${
          tone === "danger" && value > 0 ? "text-danger" : ""
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
