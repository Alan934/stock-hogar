"use client";

import { useState } from "react";
import { Printer, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { QrDialog, QrImage, useFurnitureUrl } from "@/components/stock/qr";

type FurnitureRow = {
  id: string;
  name: string;
  qrToken: string;
  sectorName: string;
};

export function QrSheet({
  furnitures,
  isAdmin,
}: {
  furnitures: FurnitureRow[];
  isAdmin: boolean;
}) {
  const [selected, setSelected] = useState<FurnitureRow | null>(null);

  return (
    <div className="space-y-5">
      <header className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Códigos QR</h1>
          <p className="text-sm text-muted">
            Imprimí esta hoja, recortá y pegá cada código en su mueble. Al
            escanearlo se abre la lista de productos para sumar o descontar.
          </p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          Imprimir todo
        </Button>
      </header>

      <div className="print-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {furnitures.map((furniture) => (
          <QrCard
            key={furniture.id}
            furniture={furniture}
            onOpen={() => setSelected(furniture)}
            isAdmin={isAdmin}
          />
        ))}
      </div>

      {selected ? (
        <QrDialog
          open
          onClose={() => setSelected(null)}
          furniture={selected}
          isAdmin={isAdmin}
        />
      ) : null}
    </div>
  );
}

function QrCard({
  furniture,
  onOpen,
  isAdmin,
}: {
  furniture: FurnitureRow;
  onOpen: () => void;
  isAdmin: boolean;
}) {
  const url = useFurnitureUrl(furniture.qrToken);

  return (
    <div className="qr-card card-shadow flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-center">
      <div className="rounded-xl bg-white p-2">
        <QrImage token={furniture.qrToken} className="size-40" size={512} />
      </div>
      <div>
        <p className="font-semibold leading-tight">{furniture.name}</p>
        <p className="text-xs text-muted">{furniture.sectorName}</p>
      </div>
      <p className="no-print break-all text-[10px] text-muted/80">{url}</p>
      <Button
        variant="ghost"
        size="sm"
        className="no-print"
        onClick={onOpen}
        aria-label={`Opciones del QR de ${furniture.name}`}
      >
        <Settings2 className="size-4" />
        {isAdmin ? "Descargar o regenerar" : "Descargar"}
      </Button>
    </div>
  );
}
