"use client";

import { useActionState } from "react";
import { LayoutGrid } from "lucide-react";

import { Card, CardBody } from "@/components/ui/card";
import { Field, FormMessage, Input, PasswordInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { loginAction } from "@/lib/actions/auth";
import { IDLE } from "@/lib/actions/types";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(loginAction, IDLE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <LayoutGrid className="size-7" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">StockHogar</h1>
          <p className="mt-1 text-sm text-muted">
            El stock de tu casa, siempre a mano.
          </p>
        </div>
      </div>

      <Card>
        <CardBody>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />

            <Field label="Correo">
              <Input
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="vos@ejemplo.com"
                required
                autoFocus
              />
            </Field>

            <Field label="Contraseña">
              <PasswordInput
                name="password"
                autoComplete="current-password"
                placeholder="Tu contraseña"
                required
              />
            </Field>

            <FormMessage state={state} />

            <SubmitButton size="lg" className="w-full">
              Ingresar
            </SubmitButton>
          </form>
        </CardBody>
      </Card>

      <p className="text-center text-xs text-muted">
        ¿No tenés cuenta? Pedile al administrador de tu familia que te cree una.
      </p>
    </div>
  );
}
