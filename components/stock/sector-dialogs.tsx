"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { ActionFormModal } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Field, Input } from "@/components/ui/field";
import { IconPicker } from "@/components/stock/icon-picker";
import {
  createSectorAction,
  deleteSectorAction,
  updateSectorAction,
} from "@/lib/actions/stock";

export function NewSectorButton({
  variant = "primary",
  className,
}: {
  variant?: "primary" | "soft" | "secondary";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nuevo sector
      </Button>

      <ActionFormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo sector"
        description="Un sector es un ambiente de la casa: cocina, baño, lavadero…"
        action={createSectorAction}
        submitLabel="Crear sector"
      >
        <Field label="Nombre">
          <Input name="name" placeholder="Cocina" required autoFocus />
        </Field>
        <Field label="Ícono">
          <IconPicker />
        </Field>
      </ActionFormModal>
    </>
  );
}

export function SectorMenu({
  sector,
  canDelete,
}: {
  sector: { id: string; name: string; icon: string };
  canDelete: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Editar ${sector.name}`}
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="size-4.5" />
      </Button>

      {canDelete ? (
        <ConfirmAction
          onConfirm={() => deleteSectorAction(sector.id)}
          title={`Eliminar ${sector.name}`}
          description="Se van a borrar también sus muebles, compartimientos y productos. Esta acción no se puede deshacer."
          trigger={(open) => (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Eliminar ${sector.name}`}
              onClick={open}
              className="hover:text-danger"
            >
              <Trash2 className="size-4.5" />
            </Button>
          )}
        />
      ) : null}

      <ActionFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Editar ${sector.name}`}
        action={updateSectorAction}
        submitLabel="Guardar"
      >
        <input type="hidden" name="id" value={sector.id} />
        <Field label="Nombre">
          <Input name="name" defaultValue={sector.name} required />
        </Field>
        <Field label="Ícono">
          <IconPicker defaultValue={sector.icon} />
        </Field>
      </ActionFormModal>
    </div>
  );
}
