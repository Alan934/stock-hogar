"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Shield, Trash2, UserPlus } from "lucide-react";

import { ActionFormModal } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Field, Input, PasswordInput, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  adminResetPasswordAction,
  assignFamilyAction,
  createUserAction,
  deleteUserAction,
  updateUserAction,
} from "@/lib/actions/admin";
import { initials } from "@/lib/utils";

type FamilyOption = { id: string; name: string };

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  familyId: string | null;
  familyName: string | null;
};

export function NewUserButton({ families }: { families: FamilyOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" />
        Nuevo usuario
      </Button>

      <ActionFormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo usuario"
        description="Creá la cuenta y pasale la contraseña. Después la puede cambiar desde Mi cuenta."
        action={createUserAction}
        submitLabel="Crear usuario"
      >
        <Field label="Nombre">
          <Input name="name" placeholder="María" required autoFocus />
        </Field>
        <Field label="Correo">
          <Input
            name="email"
            type="email"
            inputMode="email"
            placeholder="maria@ejemplo.com"
            required
          />
        </Field>
        <Field label="Contraseña inicial" hint="Mínimo 6 caracteres.">
          <PasswordInput name="password" autoComplete="new-password" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rol">
            <Select name="role" defaultValue="USER">
              <option value="USER">Integrante</option>
              <option value="ADMIN">Administrador</option>
            </Select>
          </Field>
          <Field label="Familia">
            <Select name="familyId" defaultValue={families[0]?.id ?? "none"}>
              <option value="none">Sin familia</option>
              {families.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </ActionFormModal>
    </>
  );
}

export function UserList({
  users,
  families,
  currentUserId,
}: {
  users: UserRow[];
  families: FamilyOption[];
  currentUserId: string;
}) {
  return (
    <ul className="divide-y divide-border">
      {users.map((user) => (
        <UserRowItem
          key={user.id}
          user={user}
          families={families}
          isSelf={user.id === currentUserId}
        />
      ))}
    </ul>
  );
}

function UserRowItem({
  user,
  families,
  isSelf,
}: {
  user: UserRow;
  families: FamilyOption[];
  isSelf: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { notify } = useToast();
  const router = useRouter();

  function changeFamily(familyId: string) {
    startTransition(async () => {
      const result = await assignFamilyAction(
        user.id,
        familyId === "none" ? null : familyId,
      );
      notify(
        result.ok ? (result.message ?? "Listo.") : (result.error ?? "Error"),
        result.ok ? "success" : "error",
      );
      if (result.ok) router.refresh();
    });
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">
          {initials(user.name)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{user.name}</span>
            {user.role === "ADMIN" ? (
              <Badge tone="primary">
                <Shield className="size-3" />
                Admin
              </Badge>
            ) : null}
            {!user.isActive ? <Badge tone="danger">Desactivado</Badge> : null}
            {isSelf ? <Badge>Vos</Badge> : null}
          </p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>

        <Select
          value={user.familyId ?? "none"}
          disabled={pending}
          onChange={(event) => changeFamily(event.target.value)}
          aria-label={`Familia de ${user.name}`}
          className="h-9 w-40 py-0 text-sm"
        >
          <option value="none">Sin familia</option>
          {families.map((family) => (
            <option key={family.id} value={family.id}>
              {family.name}
            </option>
          ))}
        </Select>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={`Cambiar la contraseña de ${user.name}`}
            title="Cambiar contraseña"
            onClick={() => setPasswordOpen(true)}
          >
            <KeyRound className="size-4.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={`Editar ${user.name}`}
            title="Editar"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-4.5" />
          </Button>
          {isSelf ? null : (
            <ConfirmAction
              onConfirm={() => deleteUserAction(user.id)}
              title={`Eliminar a ${user.name}`}
              description="La cuenta se borra y esa persona deja de poder ingresar. El historial de movimientos se conserva."
              trigger={(open) => (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 hover:text-danger"
                  aria-label={`Eliminar a ${user.name}`}
                  title="Eliminar"
                  onClick={open}
                >
                  <Trash2 className="size-4.5" />
                </Button>
              )}
            />
          )}
        </div>
      </div>

      <ActionFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Editar ${user.name}`}
        action={updateUserAction}
        submitLabel="Guardar"
      >
        <input type="hidden" name="id" value={user.id} />
        <Field label="Nombre">
          <Input name="name" defaultValue={user.name} required />
        </Field>
        <Field label="Correo">
          <Input name="email" type="email" defaultValue={user.email} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rol">
            <Select name="role" defaultValue={user.role}>
              <option value="USER">Integrante</option>
              <option value="ADMIN">Administrador</option>
            </Select>
          </Field>
          <Field label="Familia">
            <Select name="familyId" defaultValue={user.familyId ?? "none"}>
              <option value="none">Sin familia</option>
              {families.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={user.isActive}
            className="size-4 accent-[hsl(var(--primary))]"
          />
          <span className="text-sm">Puede ingresar a la app</span>
        </label>
      </ActionFormModal>

      <ActionFormModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title={`Contraseña de ${user.name}`}
        description="Se reemplaza por la que pongas acá. Avisale para que la cambie después."
        action={adminResetPasswordAction}
        submitLabel="Cambiar contraseña"
        size="sm"
      >
        <input type="hidden" name="id" value={user.id} />
        <Field label="Contraseña nueva" hint="Mínimo 6 caracteres.">
          <PasswordInput name="password" autoComplete="new-password" required />
        </Field>
        <Field label="Repetir contraseña">
          <PasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            required
          />
        </Field>
      </ActionFormModal>
    </li>
  );
}
