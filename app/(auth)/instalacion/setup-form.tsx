"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";

import { Card, CardBody } from "@/components/ui/card";
import { Field, FormMessage, Input, PasswordInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { setupAction } from "@/lib/actions/auth";
import { IDLE } from "@/lib/actions/types";

export function SetupForm() {
  const [state, formAction] = useActionState(setupAction, IDLE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Sparkles className="size-7" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Empecemos por tu cuenta
          </h1>
          <p className="mt-1 text-sm text-muted">
            Esta primera cuenta es la de administrador: va a poder crear al resto
            de la familia y eliminar productos.
          </p>
        </div>
      </div>

      <Card>
        <CardBody>
          <form action={formAction} className="space-y-4">
            <Field label="Tu nombre">
              <Input name="name" placeholder="Alan" required autoFocus />
            </Field>

            <Field label="Nombre de la familia o casa">
              <Input name="familyName" placeholder="Casa Sanjurjo" required />
            </Field>

            <Field label="Correo">
              <Input
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="vos@ejemplo.com"
                required
              />
            </Field>

            <Field label="Contraseña" hint="Mínimo 6 caracteres.">
              <PasswordInput
                name="password"
                autoComplete="new-password"
                required
              />
            </Field>

            <Field label="Repetir contraseña">
              <PasswordInput
                name="passwordConfirm"
                autoComplete="new-password"
                required
              />
            </Field>

            <FormMessage state={state} />

            <SubmitButton size="lg" className="w-full">
              Crear cuenta y entrar
            </SubmitButton>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
