"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  requireUser,
  validatePassword,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { families, users } from "@/lib/db/schema";
import { countUsers } from "@/lib/queries";
import { done, fail, type ActionState } from "@/lib/actions/types";

function readEmail(formData: FormData) {
  return String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) {
    return fail("Completá el correo y la contraseña.");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return fail("Correo o contraseña incorrectos.");
  }

  if (!user.isActive) {
    return fail("Tu cuenta está desactivada. Pedile al administrador que la habilite.");
  }

  await createSession(user.id);
  redirect(next.startsWith("/") ? next : "/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/ingresar");
}

/**
 * Alta del primer administrador. Sólo funciona mientras no exista ningún
 * usuario, así nadie puede volver a usarla para colarse.
 */
export async function setupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if ((await countUsers()) > 0) {
    return fail("La instalación ya fue completada.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  const familyName = String(formData.get("familyName") ?? "").trim() || "Mi casa";

  if (!name || !email) return fail("Completá tu nombre y tu correo.");
  const passwordError = validatePassword(password);
  if (passwordError) return fail(passwordError);
  if (password !== String(formData.get("passwordConfirm") ?? "")) {
    return fail("Las contraseñas no coinciden.");
  }

  const userId = await db.transaction(async (tx) => {
    const [family] = await tx
      .insert(families)
      .values({ name: familyName })
      .returning();

    const [user] = await tx
      .insert(users)
      .values({
        name,
        email,
        passwordHash: await hashPassword(password),
        role: "ADMIN",
        familyId: family.id,
      })
      .returning();

    return user.id;
  });

  await createSession(userId);
  redirect("/");
}

export async function changeOwnPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!(await verifyPassword(current, user.passwordHash))) {
    return fail("La contraseña actual no es correcta.");
  }

  const passwordError = validatePassword(next);
  if (passwordError) return fail(passwordError);
  if (next !== confirm) return fail("Las contraseñas nuevas no coinciden.");
  if (next === current) return fail("La contraseña nueva tiene que ser distinta a la actual.");

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(next), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return done("Listo, tu contraseña quedó actualizada.");
}

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return fail("El nombre no puede quedar vacío.");

  await db
    .update(users)
    .set({ name, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath("/", "layout");
  return done("Nombre actualizado.");
}

/** Se usa en el layout para saber si hay que mostrar la pantalla de instalación. */
export async function needsSetup() {
  if (await getCurrentUser()) return false;
  return (await countUsers()) === 0;
}
