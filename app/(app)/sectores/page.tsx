import Link from "next/link";
import type { Metadata } from "next";
import { Boxes, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, EmptyState } from "@/components/ui/card";
import { NewSectorButton, SectorMenu } from "@/components/stock/sector-dialogs";
import { SectorIcon } from "@/components/stock/sector-icon";
import { requireFamilyUser } from "@/lib/auth";
import { getSectorsWithStats } from "@/lib/queries";

export const metadata: Metadata = { title: "Sectores" };

export default async function SectorsPage() {
  const user = await requireFamilyUser();
  const sectorList = await getSectorsWithStats(user.familyId);
  const canDelete = user.role === "ADMIN";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sectores</h1>
          <p className="text-sm text-muted">
            Los ambientes de la casa. Adentro de cada uno van los muebles.
          </p>
        </div>
        <NewSectorButton />
      </header>

      {sectorList.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-8" />}
          title="Todavía no hay sectores"
          description="Creá el primero: cocina, baño, lavadero, despensa… lo que uses en tu casa."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sectorList.map((sector) => (
            <Card key={sector.id} className="transition-colors hover:border-primary/40">
              <CardBody className="flex items-center gap-3 py-3.5">
                <Link
                  href={`/sectores/${sector.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
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
                    <Badge tone="warning">{sector.lowCount} a reponer</Badge>
                  ) : null}
                  <ChevronRight className="size-4 shrink-0 text-muted" />
                </Link>
                <SectorMenu sector={sector} canDelete={canDelete} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
