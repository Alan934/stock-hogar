"use client";

import { useState } from "react";
import { HousePlus, Pencil, Trash2 } from "lucide-react";

import { ActionFormModal } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Field, Input } from "@/components/ui/field";
import {
  createFamilyAction,
  deleteFamilyAction,
  updateFamilyAction,
} from "@/lib/actions/admin";

type FamilyRow = {
  id: string;
  name: string;
  memberCount: number;
};

export function NewFamilyButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <HousePlus className="size-4" />
        Nueva familia
      </Button>

      <ActionFormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva familia"
        description="Cada familia tiene sus propios sectores, muebles y productos."
        action={createFamilyAction}
        submitLabel="Crear familia"
        size="sm"
      >
        <Field label="Nombre">
          <Input name="name" placeholder="Casa de la abuela" required autoFocus />
        </Field>
      </ActionFormModal>
    </>
  );
}

export function FamilyList({
  families,
  currentFamilyId,
}: {
  families: FamilyRow[];
  currentFamilyId: string | null;
}) {
  return (
    <ul className="divide-y divide-border">
      {families.map((family) => (
        <FamilyRowItem
          key={family.id}
          family={family}
          isOwn={family.id === currentFamilyId}
        />
      ))}
    </ul>
  );
}

function FamilyRowItem({
  family,
  isOwn,
}: {
  family: FamilyRow;
  isOwn: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          <span className="truncate">{family.name}</span>
          {isOwn ? <Badge tone="primary">La tuya</Badge> : null}
        </p>
        <p className="text-xs text-muted">
          {family.memberCount}{" "}
          {family.memberCount === 1 ? "integrante" : "integrantes"}
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="size-9"
        aria-label={`Editar ${family.name}`}
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="size-4.5" />
      </Button>

      {isOwn ? null : (
        <ConfirmAction
          onConfirm={() => deleteFamilyAction(family.id)}
          title={`Eliminar ${family.name}`}
          description="Se borran todos sus sectores, muebles y productos. Los usuarios quedan sin familia asignada."
          trigger={(open) => (
            <Button
              variant="ghost"
              size="icon"
              className="size-9 hover:text-danger"
              aria-label={`Eliminar ${family.name}`}
              onClick={open}
            >
              <Trash2 className="size-4.5" />
            </Button>
          )}
        />
      )}

      <ActionFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Editar ${family.name}`}
        action={updateFamilyAction}
        submitLabel="Guardar"
        size="sm"
      >
        <input type="hidden" name="id" value={family.id} />
        <Field label="Nombre">
          <Input name="name" defaultValue={family.name} required autoFocus />
        </Field>
      </ActionFormModal>
    </li>
  );
}
