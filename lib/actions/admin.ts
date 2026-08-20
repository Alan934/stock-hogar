"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";

import { hashPassword, requireAdmin, validatePassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { families, users, type Role } from "@/lib/db/schema";
import { done, fail, type ActionState } from "@/lib/actions/types";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readRole(formData: FormData): Role {
  return text(formData, "role") === "ADMIN" ? "ADMIN" : "USER";
}

function readFamilyId(formData: FormData) {
  const value = text(formData, "familyId");
  return value && value !== "none" ? value : null;
}

function refresh() {
  revalidatePath("/", "layout");
}

async function countAdmins(excludingUserId?: string) {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(
      excludingUserId
        ? and(eq(users.role, "ADMIN"), ne(users.id, excludingUserId))
        : eq(users.role, "ADMIN"),
    );
  return row?.total ?? 0;
}

/* ------------------------------------------------------------------ */
/* Usuarios                                                            */
/* ------------------------------------------------------------------ */

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const name = text(formData, "name");
  const email = text(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) return fail("Poné el nombre de la persona.");
  if (!email.includes("@")) return fail("El correo no parece válido.");

  const passwordError = validatePassword(password);
  if (passwordError) return fail(passwordError);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length) return fail("Ya hay una cuenta con ese correo.");

  await db.insert(users).values({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: readRole(formData),
    familyId: readFamilyId(formData),
  });

  refresh();
  return done(`${name} ya puede ingresar.`);
}

export async function updateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const id = text(formData, "id");
  const name = text(formData, "name");
  const email = text(formData, "email").toLowerCase();
  const role = readRole(formData);
  const isActive = formData.get("isActive") === "on" || formData.get("isActive") === "true";

  if (!name) return fail("El nombre no puede quedar vacío.");
  if (!email.includes("@")) return fail("El correo no parece válido.");

  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return fail("No encontramos ese usuario.");

  if (target.role === "ADMIN" && role !== "ADMIN" && (await countAdmins(id)) === 0) {
    return fail("Tiene que quedar al menos un administrador.");
  }

  if (target.id === admin.id && (!isActive || role !== "ADMIN")) {
    return fail("No podés quitarte a vos mismo el rol de administrador ni desactivarte.");
  }

  const duplicated = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), ne(users.id, id)))
    .limit(1);

  if (duplicated.length) return fail("Ya hay otra cuenta con ese correo.");

  await db
    .update(users)
    .set({
      name,
      email,
      role,
      isActive,
      familyId: readFamilyId(formData),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));

  refresh();
  return done("Usuario actualizado.");
}

/** El admin le pone una contraseña nueva a cualquier integrante. */
export async function adminResetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = text(formData, "id");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  const passwordError = validatePassword(password);
  if (passwordError) return fail(passwordError);
  if (password !== confirm) return fail("Las contraseñas no coinciden.");

  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return fail("No encontramos ese usuario.");

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
    .where(eq(users.id, id));

  refresh();
  return done(`Contraseña de ${target.name} actualizada.`);
}

export async function assignFamilyAction(
  userId: string,
  familyId: string | null,
): Promise<ActionState> {
  await requireAdmin();

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return fail("No encontramos ese usuario.");

  if (familyId) {
    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.id, familyId))
      .limit(1);
    if (!family) return fail("No encontramos esa familia.");
  }

  await db
    .update(users)
    .set({ familyId, updatedAt: new Date() })
    .where(eq(users.id, userId));

  refresh();
  return done("Familia asignada.");
}

export async function deleteUserAction(userId: string): Promise<ActionState> {
  const admin = await requireAdmin();

  if (userId === admin.id) return fail("No podés eliminar tu propia cuenta.");

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return fail("No encontramos ese usuario.");

  if (target.role === "ADMIN" && (await countAdmins(userId)) === 0) {
    return fail("Tiene que quedar al menos un administrador.");
  }

  await db.delete(users).where(eq(users.id, userId));
  refresh();
  return done(`${target.name} fue eliminado.`);
}

/* ------------------------------------------------------------------ */
/* Familias                                                            */
/* ------------------------------------------------------------------ */

export async function createFamilyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const name = text(formData, "name");
  if (!name) return fail("Poné un nombre para la familia.");

  await db.insert(families).values({ name });
  refresh();
  return done(`Familia "${name}" creada.`);
}

export async function updateFamilyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) return fail("Poné un nombre para la familia.");

  await db.update(families).set({ name }).where(eq(families.id, id));
  refresh();
  return done("Familia actualizada.");
}

export async function deleteFamilyAction(id: string): Promise<ActionState> {
  const admin = await requireAdmin();

  if (admin.familyId === id) {
    return fail("No podés eliminar la familia a la que pertenecés.");
  }

  const [family] = await db.select().from(families).where(eq(families.id, id)).limit(1);
  if (!family) return fail("No encontramos esa familia.");

  await db.delete(families).where(eq(families.id, id));
  refresh();
  return done(`Familia "${family.name}" eliminada (sus sectores y productos también).`);
}
