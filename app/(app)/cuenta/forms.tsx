"use client";

import { useActionState } from "react";

import { Field, FormMessage, Input, PasswordInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  changeOwnPasswordAction,
  updateProfileAction,
} from "@/lib/actions/auth";
import { IDLE } from "@/lib/actions/types";

export function ProfileForm({ defaultName }: { defaultName: string }) {
  const [state, formAction] = useActionState(updateProfileAction, IDLE);

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Nombre">
        <Input name="name" defaultValue={defaultName} required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Guardar</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changeOwnPasswordAction, IDLE);

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Contraseña actual">
        <PasswordInput
          name="currentPassword"
          autoComplete="current-password"
          required
        />
      </Field>
      <Field label="Contraseña nueva" hint="Mínimo 6 caracteres.">
        <PasswordInput name="newPassword" autoComplete="new-password" required />
      </Field>
      <Field label="Repetir contraseña nueva">
        <PasswordInput
          name="confirmPassword"
          autoComplete="new-password"
          required
        />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>Cambiar contraseña</SubmitButton>
    </form>
  );
}
