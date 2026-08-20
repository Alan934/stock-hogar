import type { Metadata } from "next";
import { LogOut, Shield, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme";
import { ChangePasswordForm, ProfileForm } from "./forms";
import { logoutAction } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth";
import { getFamily, getFamilyMembers } from "@/lib/queries";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const user = await requireUser();
  const family = user.familyId ? await getFamily(user.familyId) : null;
  const members = user.familyId ? await getFamilyMembers(user.familyId) : [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mi cuenta</h1>
        <p className="text-sm text-muted">
          {user.email}
          {user.role === "ADMIN" ? " · administrador" : ""}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Apariencia</CardTitle>
        </CardHeader>
        <CardBody className="flex items-center justify-between gap-4 pt-3">
          <p className="text-sm text-muted">
            Elegí el tema claro, el oscuro o dejá que siga al del teléfono.
          </p>
          <ThemeToggle />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tus datos</CardTitle>
        </CardHeader>
        <CardBody className="pt-3">
          <ProfileForm defaultName={user.name} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardBody className="pt-3">
          <ChangePasswordForm />
        </CardBody>
      </Card>

      {family ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4.5 text-muted" />
              {family.name}
            </CardTitle>
          </CardHeader>
          <CardBody className="pt-3">
            <ul className="divide-y divide-border">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {member.name}
                      {member.id === user.id ? " (vos)" : ""}
                    </p>
                    <p className="truncate text-xs text-muted">{member.email}</p>
                  </div>
                  {member.role === "ADMIN" ? (
                    <Badge tone="primary">
                      <Shield className="size-3" />
                      Admin
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <form action={logoutAction}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-danger transition-colors hover:bg-danger-soft"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
