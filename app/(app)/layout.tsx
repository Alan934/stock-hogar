import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { getFamily, countUsers } from "@/lib/queries";

// La app siempre depende de la sesión: nunca se prerenderiza en el build.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  if (!user) {
    // Base recién creada: mandamos a crear el primer administrador.
    if ((await countUsers()) === 0) redirect("/instalacion");
    redirect("/ingresar");
  }

  const family = user.familyId ? await getFamily(user.familyId) : null;

  return (
    <AppShell user={{ name: user.name, role: user.role }} familyName={family?.name ?? null}>
      {children}
    </AppShell>
  );
}
