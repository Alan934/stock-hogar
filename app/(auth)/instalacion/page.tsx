import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { SetupForm } from "./setup-form";
import { countUsers } from "@/lib/queries";

export const metadata: Metadata = { title: "Instalación" };

export default async function SetupPage() {
  if ((await countUsers()) > 0) redirect("/ingresar");
  return <SetupForm />;
}
