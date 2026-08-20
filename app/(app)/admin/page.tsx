import type { Metadata } from "next";
import { Shield } from "lucide-react";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { FamilyList, NewFamilyButton } from "./family-list";
import { NewUserButton, UserList } from "./user-list";
import { requireAdmin } from "@/lib/auth";
import { getAllFamilies, getAllUsers } from "@/lib/queries";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminPage() {
  const admin = await requireAdmin();

  const [userList, familyList] = await Promise.all([
    getAllUsers(),
    getAllFamilies(),
  ]);

  const familyOptions = familyList.map((family) => ({
    id: family.id,
    name: family.name,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Shield className="size-5.5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Administración
            </h1>
            <p className="text-sm text-muted">
              Usuarios, familias y contraseñas.
            </p>
          </div>
        </div>
      </header>

      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>Usuarios ({userList.length})</CardTitle>
          <NewUserButton families={familyOptions} />
        </CardHeader>
        <CardBody className="pt-3">
          <UserList
            users={userList}
            families={familyOptions}
            currentUserId={admin.id}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>Familias ({familyList.length})</CardTitle>
          <NewFamilyButton />
        </CardHeader>
        <CardBody className="pt-3">
          <FamilyList families={familyList} currentFamilyId={admin.familyId} />
        </CardBody>
      </Card>
    </div>
  );
}
