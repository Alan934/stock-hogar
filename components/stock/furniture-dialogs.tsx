"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { ActionFormModal } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Field, Input } from "@/components/ui/field";
import {
  createCompartmentAction,
  createFurnitureAction,
  deleteCompartmentAction,
  deleteFurnitureAction,
  updateCompartmentAction,
  updateFurnitureAction,
} from "@/lib/actions/stock";

export function NewFurnitureButton({
  sectorId,
  variant = "primary",
}: {
  sectorId: string;
  variant?: "primary" | "soft" | "secondary";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nuevo mueble
      </Button>

      <ActionFormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo mueble"
        description="Heladera, alacena, placard… Cada mueble tiene su propio código QR."
        action={createFurnitureAction}
        submitLabel="Crear mueble"
      >
        <input type="hidden" name="sectorId" value={sectorId} />
        <Field label="Nombre">
          <Input name="name" placeholder="Heladera" required autoFocus />
        </Field>
        <Field
          label="Primer compartimiento"
          hint="Después podés agregar todos los que quieras."
        >
          <Input name="firstCompartment" placeholder="General" defaultValue="General" />
        </Field>
      </ActionFormModal>
    </>
  );
}

export function FurnitureMenu({
  furniture,
  canDelete,
}: {
  furniture: { id: string; name: string };
  canDelete: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Editar ${furniture.name}`}
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="size-4.5" />
      </Button>

      {canDelete ? (
        <ConfirmAction
          onConfirm={() => deleteFurnitureAction(furniture.id)}
          title={`Eliminar ${furniture.name}`}
          description="Se borran sus compartimientos y todos los productos que tenga adentro."
          trigger={(open) => (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Eliminar ${furniture.name}`}
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
        title={`Editar ${furniture.name}`}
        action={updateFurnitureAction}
        submitLabel="Guardar"
      >
        <input type="hidden" name="id" value={furniture.id} />
        <Field label="Nombre">
          <Input name="name" defaultValue={furniture.name} required autoFocus />
        </Field>
      </ActionFormModal>
    </div>
  );
}

export function NewCompartmentButton({ furnitureId }: { furnitureId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Compartimiento
      </Button>

      <ActionFormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo compartimiento"
        description="Por ejemplo: freezer, heladera, cajón de verduras, estante de arriba."
        action={createCompartmentAction}
        submitLabel="Crear"
      >
        <input type="hidden" name="furnitureId" value={furnitureId} />
        <Field label="Nombre">
          <Input name="name" placeholder="Freezer" required autoFocus />
        </Field>
      </ActionFormModal>
    </>
  );
}

export function CompartmentMenu({
  compartment,
  canDelete,
}: {
  compartment: { id: string; name: string };
  canDelete: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={`Editar ${compartment.name}`}
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="size-4" />
      </Button>

      {canDelete ? (
        <ConfirmAction
          onConfirm={() => deleteCompartmentAction(compartment.id)}
          title={`Eliminar ${compartment.name}`}
          description="Se borran también los productos guardados en este compartimiento."
          trigger={(open) => (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 hover:text-danger"
              aria-label={`Eliminar ${compartment.name}`}
              onClick={open}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        />
      ) : null}

      <ActionFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Editar ${compartment.name}`}
        action={updateCompartmentAction}
        submitLabel="Guardar"
        size="sm"
      >
        <input type="hidden" name="id" value={compartment.id} />
        <Field label="Nombre">
          <Input name="name" defaultValue={compartment.name} required autoFocus />
        </Field>
      </ActionFormModal>
    </div>
  );
}
