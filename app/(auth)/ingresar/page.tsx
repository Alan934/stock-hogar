import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { LoginForm } from "./login-form";
import { getCurrentUser } from "@/lib/auth";
import { countUsers } from "@/lib/queries";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: PageProps<"/ingresar">) {
  if (await getCurrentUser()) redirect("/");
  if ((await countUsers()) === 0) redirect("/instalacion");

  const params = await searchParams;
  const raw = params?.next;
  const next = typeof raw === "string" && raw.startsWith("/") ? raw : "/";

  return <LoginForm next={next} />;
}
