import bcrypt from "bcryptjs";

/**
 * Reglas de contraseña, aparte de `lib/auth.ts` para que también las puedan
 * usar los scripts de consola (que corren fuera de Next.js).
 */

export const PASSWORD_MIN_LENGTH = 6;

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function validatePassword(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña tiene que tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  return null;
}
