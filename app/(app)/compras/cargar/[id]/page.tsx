import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CheckCircle2, PackagePlus, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { IntakeReview } from "./intake-review";
import { requireFamilyUser } from "@/lib/auth";
import { getAllCompartments, getCatalog, getIntakeBatch } from "@/lib/queries";

export const metadata: Metadata = { title: "Cargar la compra" };

export default async function IntakePage({
  params,
}: PageProps<"/compras/cargar/[id]">) {
  const user = await requireFamilyUser();
  const { id } = await params;

  const found = await getIntakeBatch(user.familyId, id);
  if (!found) notFound();

  const back = (
    <Link
      href="/compras"
      className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Lista de compras
    </Link>
  );

  // Una carga confirmada o descartada ya no se edita: queda como constancia.
  if (found.batch.status !== "BORRADOR") {
    const confirmed = found.batch.status === "CONFIRMADO";
    return (
      <div className="space-y-6">
        {back}
        <EmptyState
          icon={
            confirmed ? (
              <CheckCircle2 className="size-8 text-success" />
            ) : (
              <TriangleAlert className="size-8" />
            )
          }
          title={confirmed ? "Esta carga ya se guardó" : "Esta carga se descartó"}
          description={
            confirmed
              ? "Sus productos ya están en el stock de la casa y quedaron anotados en el historial."
              : "El borrador se tiró sin tocar el stock."
          }
          action={
            <Link href="/compras">
              <Button variant="soft">Volver a la lista</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const [catalog, compartments] = await Promise.all([
    getCatalog(user.familyId),
    getAllCompartments(user.familyId),
  ]);

  return (
    <div className="space-y-5">
      {back}

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <PackagePlus className="size-6 text-primary" />
          Cargar la compra
        </h1>
        <p className="text-sm text-muted">
          Revisá cantidad y lugar de cada cosa. Nada toca el stock hasta que
          apretás <strong className="text-foreground">Guardar todo</strong>, así
          que podés empezar en el super y terminar en casa.
        </p>
      </header>

      {compartments.length === 0 ? (
        <EmptyState
          icon={<TriangleAlert className="size-8 text-warning" />}
          title="Todavía no hay dónde guardar nada"
          description="Creá al menos un mueble con un compartimiento y volvé a esta pantalla."
          action={
            <Link href="/sectores">
              <Button variant="soft">Ir a sectores</Button>
            </Link>
          }
        />
      ) : (
        <IntakeReview
          batchId={found.batch.id}
          initialLines={found.lines.map((line) => ({
            id: line.id,
            productId: line.productId,
            rawLabel: line.rawLabel,
            quantity: line.quantity,
            compartmentId: line.compartmentId,
            skipped: line.skipped,
            productName: line.productName,
            productUnit: line.productUnit,
            productStep: line.productStep,
            total: line.total,
          }))}
          catalog={catalog.map((item) => ({
            id: item.id,
            name: item.name,
            unit: item.unit,
            step: item.step,
            total: item.total,
          }))}
          compartments={compartments}
        />
      )}
    </div>
  );
}
