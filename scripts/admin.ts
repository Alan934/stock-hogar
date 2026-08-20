/**
 * Crea la cuenta de administrador, o recupera el acceso si te olvidaste la
 * contraseña. Es idempotente: se puede correr todas las veces que haga falta.
 *
 *   npm run db:admin -- --email vos@ejemplo.com --password tuclave
 *   npm run db:admin -- --email vos@ejemplo.com --password otraclave   (la cambia)
 *
 * Si no pasás argumentos, toma los valores de estas variables del .env:
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_FAMILY
 *
 * Sobre una cuenta que ya existe: le pone el rol de administrador, la reactiva
 * si estaba desactivada y, sólo si le pasaste una contraseña, la reemplaza.
 */
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { families, users } from "@/lib/db/schema";
import { hashPassword, validatePassword } from "@/lib/password";

function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index > -1 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : fallback;
}

const EMAIL = arg("email", process.env.ADMIN_EMAIL ?? "")
  .trim()
  .toLowerCase();
const PASSWORD = arg("password", process.env.ADMIN_PASSWORD ?? "");
const NAME = arg("nombre", process.env.ADMIN_NAME ?? "").trim();
const FAMILY_NAME = arg("familia", process.env.ADMIN_FAMILY ?? "Mi casa").trim();

const USAGE = `
Uso:
  npm run db:admin -- --email vos@ejemplo.com --password tuclave [--nombre "Tu nombre"] [--familia "Casa"]

También podés dejar ADMIN_EMAIL y ADMIN_PASSWORD en el .env y correrlo sin argumentos.
`;

function fatal(message: string): never {
  console.error(`\n${message}${USAGE}`);
  process.exit(1);
}

/** Reusa la familia si ya existe con ese nombre; si no, la crea. */
async function ensureFamily() {
  const [existing] = await db
    .select()
    .from(families)
    .where(eq(families.name, FAMILY_NAME))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(families)
    .values({ name: FAMILY_NAME })
    .returning();

  console.log(`Familia creada: ${created.name}`);
  return created;
}

async function main() {
  if (!EMAIL || !EMAIL.includes("@")) {
    fatal("Falta el correo del administrador (--email o ADMIN_EMAIL).");
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, EMAIL))
    .limit(1);

  if (PASSWORD) {
    const error = validatePassword(PASSWORD);
    if (error) fatal(error);
  }

  if (existing) {
    const changes: string[] = [];

    if (existing.role !== "ADMIN") changes.push("ahora es administrador");
    if (!existing.isActive) changes.push("cuenta reactivada");
    if (PASSWORD) changes.push("contraseña actualizada");

    const familyId = existing.familyId ?? (await ensureFamily()).id;
    if (!existing.familyId) changes.push(`asignado a "${FAMILY_NAME}"`);

    await db
      .update(users)
      .set({
        role: "ADMIN",
        isActive: true,
        familyId,
        ...(NAME ? { name: NAME } : {}),
        ...(PASSWORD ? { passwordHash: await hashPassword(PASSWORD) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));

    console.log(`\nCuenta de ${EMAIL} lista.`);
    console.log(
      changes.length ? `Cambios: ${changes.join(", ")}.` : "No hizo falta cambiar nada.",
    );
    return;
  }

  if (!PASSWORD) {
    fatal(
      `No existe ninguna cuenta con ${EMAIL}, así que hace falta una contraseña para crearla (--password o ADMIN_PASSWORD).`,
    );
  }

  const family = await ensureFamily();

  await db.insert(users).values({
    name: NAME || "Administrador",
    email: EMAIL,
    passwordHash: await hashPassword(PASSWORD),
    role: "ADMIN",
    familyId: family.id,
  });

  console.log(`\nAdministrador creado: ${EMAIL} (familia "${family.name}").`);
  console.log("Ya podés ingresar con la contraseña que pasaste.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Falló la creación del administrador:", error);
    process.exit(1);
  });
