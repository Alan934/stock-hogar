import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";

import { db } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";

// Se reexportan para que el resto de la app siga pidiéndoselas a `lib/auth`.
export {
  hashPassword,
  verifyPassword,
  validatePassword,
  PASSWORD_MIN_LENGTH,
} from "@/lib/password";

const COOKIE_NAME = "stockhogar_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 días

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "Falta AUTH_SECRET (o es demasiado corto). Generá uno con: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
    );
  }
  return new TextEncoder().encode(secret);
}

/* ------------------------------------------------------------------ */
/* Sesión                                                              */
/* ------------------------------------------------------------------ */

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

async function readSessionUserId() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Usuario de la petición actual. Se lee siempre desde la base para que un
 * cambio de rol, de familia o una baja tengan efecto inmediato.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.isActive) return null;
  return user;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/** Usuario que además pertenece a una familia (necesario para ver stock). */
export async function requireFamilyUser(): Promise<User & { familyId: string }> {
  const user = await requireUser();
  if (!user.familyId) redirect("/sin-familia");
  return user as User & { familyId: string };
}

export function isAdmin(user: Pick<User, "role"> | null | undefined) {
  return user?.role === "ADMIN";
}
