import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ChevronRight, PackageOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, EmptyState } from "@/components/ui/card";
import {
  FurnitureMenu,
  NewFurnitureButton,
} from "@/components/stock/furniture-dialogs";
import { SectorIcon } from "@/components/stock/sector-icon";
import { requireFamilyUser } from "@/lib/auth";
import { getFurnituresWithStats, getSector } from "@/lib/queries";

export async function generateMetadata({
  params,
}: PageProps<"/sectores/[id]">): Promise<Metadata> {
  const user = await requireFamilyUser();
  const { id } = await params;
  const sector = await getSector(user.familyId, id);
  return { title: sector?.name ?? "Sector" };
}

export default async function SectorPage({ params }: PageProps<"/sectores/[id]">) {
  const user = await requireFamilyUser();
  const { id } = await params;

  const sector = await getSector(user.familyId, id);
  if (!sector) notFound();

  const furnitureList = await getFurnituresWithStats(sector.id);
  const canDelete = user.role === "ADMIN";

  return (
    <div className="space-y-5">
      <Link
        href="/sectores"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Sectores
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <SectorIcon name={sector.icon} className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{sector.name}</h1>
            <p className="text-sm text-muted">
              {furnitureList.length}{" "}
              {furnitureList.length === 1 ? "mueble" : "muebles"} en este sector
            </p>
          </div>
        </div>
        <NewFurnitureButton sectorId={sector.id} />
      </header>

      {furnitureList.length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="size-8" />}
          title="Este sector no tiene muebles"
          description="Agregá la heladera, la alacena o el placard. Cada mueble se divide después en compartimientos."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {furnitureList.map((furniture) => (
            <Card
              key={furniture.id}
              className="transition-colors hover:border-primary/40"
            >
              <CardBody className="flex items-center gap-2 py-3.5">
                <Link
                  href={`/muebles/${furniture.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{furniture.name}</p>
                    <p className="text-xs text-muted">
                      {furniture.compartmentCount}{" "}
                      {furniture.compartmentCount === 1
                        ? "compartimiento"
                        : "compartimientos"}{" "}
                      · {furniture.productCount}{" "}
                      {furniture.productCount === 1 ? "producto" : "productos"}
                    </p>
                  </div>
                  {furniture.lowCount > 0 ? (
                    <Badge tone="warning">{furniture.lowCount}</Badge>
                  ) : null}
                  <ChevronRight className="size-4 shrink-0 text-muted" />
                </Link>
                <FurnitureMenu furniture={furniture} canDelete={canDelete} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
