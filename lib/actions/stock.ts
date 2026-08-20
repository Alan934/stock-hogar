"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";

import { requireFamilyUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  compartments,
  furnitures,
  movements,
  products,
  sectors,
  unitEnum,
  type Unit,
  type User,
} from "@/lib/db/schema";
import { createToken, round3 } from "@/lib/utils";
import { unitInfo } from "@/lib/units";
import {
  done,
  fail,
  type ActionState,
  type QuantityResult,
} from "@/lib/actions/types";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function refresh() {
  revalidatePath("/", "layout");
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numberOr(formData: FormData, key: string, fallback: number) {
  const raw = String(formData.get(key) ?? "").replace(",", ".").trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? round3(parsed) : fallback;
}

function readUnit(formData: FormData): Unit {
  const raw = String(formData.get("unit") ?? "UNIDAD");
  return (unitEnum.enumValues as readonly string[]).includes(raw)
    ? (raw as Unit)
    : "UNIDAD";
}

async function findSector(familyId: string, sectorId: string) {
  const [row] = await db
    .select()
    .from(sectors)
    .where(and(eq(sectors.id, sectorId), eq(sectors.familyId, familyId)))
    .limit(1);
  return row ?? null;
}

async function findFurniture(familyId: string, furnitureId: string) {
  const [row] = await db
    .select({ furniture: furnitures, familyId: sectors.familyId })
    .from(furnitures)
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(eq(furnitures.id, furnitureId))
    .limit(1);
  return row && row.familyId === familyId ? row.furniture : null;
}

async function findCompartment(familyId: string, compartmentId: string) {
  const [row] = await db
    .select({ compartment: compartments, familyId: sectors.familyId })
    .from(compartments)
    .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(eq(compartments.id, compartmentId))
    .limit(1);
  return row && row.familyId === familyId ? row.compartment : null;
}

async function findProduct(familyId: string, productId: string) {
  const [row] = await db
    .select({ product: products, familyId: sectors.familyId })
    .from(products)
    .innerJoin(compartments, eq(compartments.id, products.compartmentId))
    .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(eq(products.id, productId))
    .limit(1);
  return row && row.familyId === familyId ? row.product : null;
}

function onlyAdmin(user: User) {
  return user.role === "ADMIN"
    ? null
    : fail("Sólo el administrador puede eliminar. Pedile a quien administra la casa.");
}

/* ------------------------------------------------------------------ */
/* Sectores                                                            */
/* ------------------------------------------------------------------ */

export async function createSectorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireFamilyUser();
  const name = text(formData, "name");
  const icon = text(formData, "icon") || "box";

  if (!name) return fail("Poné un nombre para el sector.");

  const existing = await db
    .select({ id: sectors.id })
    .from(sectors)
    .where(and(eq(sectors.familyId, user.familyId), eq(sectors.name, name)))
    .limit(1);

  if (existing.length) return fail(`Ya existe un sector llamado "${name}".`);

  await db.insert(sectors).values({ familyId: user.familyId, name, icon });
  refresh();
  return done(`Sector "${name}" creado.`);
}

export async function updateSectorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireFamilyUser();
  const id = text(formData, "id");
  const name = text(formData, "name");
  const icon = text(formData, "icon") || "box";

  if (!name) return fail("Poné un nombre para el sector.");
  if (!(await findSector(user.familyId, id))) return fail("No encontramos ese sector.");

  await db.update(sectors).set({ name, icon }).where(eq(sectors.id, id));
  refresh();
  return done("Sector actualizado.");
}

export async function deleteSectorAction(id: string): Promise<ActionState> {
  const user = await requireFamilyUser();
  const denied = onlyAdmin(user);
  if (denied) return denied;

  if (!(await findSector(user.familyId, id))) return fail("No encontramos ese sector.");

  await db.delete(sectors).where(eq(sectors.id, id));
  refresh();
  return done("Sector eliminado.");
}

/* ------------------------------------------------------------------ */
/* Muebles                                                             */
/* ------------------------------------------------------------------ */

export async function createFurnitureAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireFamilyUser();
  const sectorId = text(formData, "sectorId");
  const name = text(formData, "name");

  if (!name) return fail("Poné un nombre para el mueble.");
  if (!(await findSector(user.familyId, sectorId))) {
    return fail("No encontramos ese sector.");
  }

  const [furniture] = await db
    .insert(furnitures)
    .values({ sectorId, name, qrToken: createToken() })
    .returning();

  // Un mueble sin compartimientos no sirve para nada: le damos uno general.
  const defaultCompartment = text(formData, "firstCompartment") || "General";
  await db
    .insert(compartments)
    .values({ furnitureId: furniture.id, name: defaultCompartment });

  refresh();
  return done(`Mueble "${name}" creado.`);
}

export async function updateFurnitureAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireFamilyUser();
  const id = text(formData, "id");
  const name = text(formData, "name");

  if (!name) return fail("Poné un nombre para el mueble.");
  if (!(await findFurniture(user.familyId, id))) return fail("No encontramos ese mueble.");

  await db.update(furnitures).set({ name }).where(eq(furnitures.id, id));
  refresh();
  return done("Mueble actualizado.");
}

export async function deleteFurnitureAction(id: string): Promise<ActionState> {
  const user = await requireFamilyUser();
  const denied = onlyAdmin(user);
  if (denied) return denied;

  if (!(await findFurniture(user.familyId, id))) return fail("No encontramos ese mueble.");

  await db.delete(furnitures).where(eq(furnitures.id, id));
  refresh();
  return done("Mueble eliminado.");
}

/** Genera un token nuevo: el QR viejo deja de funcionar. */
export async function regenerateQrAction(id: string): Promise<ActionState> {
  const user = await requireFamilyUser();
  const denied = onlyAdmin(user);
  if (denied) return denied;

  if (!(await findFurniture(user.familyId, id))) return fail("No encontramos ese mueble.");

  await db
    .update(furnitures)
    .set({ qrToken: createToken() })
    .where(eq(furnitures.id, id));

  refresh();
  return done("Código QR regenerado. Acordate de imprimirlo de nuevo.");
}

/* ------------------------------------------------------------------ */
/* Compartimientos                                                     */
/* ------------------------------------------------------------------ */

export async function createCompartmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireFamilyUser();
  const furnitureId = text(formData, "furnitureId");
  const name = text(formData, "name");

  if (!name) return fail("Poné un nombre para el compartimiento.");
  if (!(await findFurniture(user.familyId, furnitureId))) {
    return fail("No encontramos ese mueble.");
  }

  await db.insert(compartments).values({ furnitureId, name });
  refresh();
  return done(`Compartimiento "${name}" creado.`);
}

export async function updateCompartmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireFamilyUser();
  const id = text(formData, "id");
  const name = text(formData, "name");

  if (!name) return fail("Poné un nombre para el compartimiento.");
  if (!(await findCompartment(user.familyId, id))) {
    return fail("No encontramos ese compartimiento.");
  }

  await db.update(compartments).set({ name }).where(eq(compartments.id, id));
  refresh();
  return done("Compartimiento actualizado.");
}

export async function deleteCompartmentAction(id: string): Promise<ActionState> {
  const user = await requireFamilyUser();
  const denied = onlyAdmin(user);
  if (denied) return denied;

  if (!(await findCompartment(user.familyId, id))) {
    return fail("No encontramos ese compartimiento.");
  }

  await db.delete(compartments).where(eq(compartments.id, id));
  refresh();
  return done("Compartimiento eliminado.");
}

/* ------------------------------------------------------------------ */
/* Productos                                                           */
/* ------------------------------------------------------------------ */

export async function createProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireFamilyUser();
  const compartmentId = text(formData, "compartmentId");
  const name = text(formData, "name");
  const unit = readUnit(formData);

  if (!name) return fail("Poné un nombre para el producto.");
  if (!(await findCompartment(user.familyId, compartmentId))) {
    return fail("No encontramos ese compartimiento.");
  }

  const quantity = Math.max(0, numberOr(formData, "quantity", 0));
  const minQuantity = Math.max(0, numberOr(formData, "minQuantity", 0));
  const step = Math.max(0.001, numberOr(formData, "step", unitInfo(unit).defaultStep));
  const notes = text(formData, "notes") || null;
  const expiresAt = text(formData, "expiresAt") || null;

  const [product] = await db
    .insert(products)
    .values({
      compartmentId,
      name,
      unit,
      quantity,
      minQuantity,
      step,
      notes,
      expiresAt,
      createdById: user.id,
    })
    .returning();

  await db.insert(movements).values({
    productId: product.id,
    userId: user.id,
    userName: user.name,
    kind: "ALTA",
    delta: quantity,
    resulting: quantity,
    note: "Producto agregado",
  });

  refresh();
  return done(`"${name}" agregado.`);
}

export async function updateProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireFamilyUser();
  const id = text(formData, "id");
  const current = await findProduct(user.familyId, id);
  if (!current) return fail("No encontramos ese producto.");

  const name = text(formData, "name");
  if (!name) return fail("El nombre no puede quedar vacío.");

  const unit = readUnit(formData);
  const compartmentId = text(formData, "compartmentId") || current.compartmentId;

  if (
    compartmentId !== current.compartmentId &&
    !(await findCompartment(user.familyId, compartmentId))
  ) {
    return fail("No encontramos ese compartimiento.");
  }

  await db
    .update(products)
    .set({
      name,
      unit,
      compartmentId,
      minQuantity: Math.max(0, numberOr(formData, "minQuantity", current.minQuantity)),
      step: Math.max(0.001, numberOr(formData, "step", current.step)),
      notes: text(formData, "notes") || null,
      expiresAt: text(formData, "expiresAt") || null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));

  refresh();
  return done("Producto actualizado.");
}

export async function deleteProductAction(id: string): Promise<ActionState> {
  const user = await requireFamilyUser();
  const denied = onlyAdmin(user);
  if (denied) return denied;

  const product = await findProduct(user.familyId, id);
  if (!product) return fail("No encontramos ese producto.");

  await db.delete(products).where(eq(products.id, id));
  refresh();
  return done(`"${product.name}" eliminado.`);
}

/**
 * Suma o resta cantidad. Es la operación más usada de toda la app: la hace
 * cualquier integrante de la familia desde los botones + / -.
 */
export async function adjustQuantityAction(
  productId: string,
  delta: number,
): Promise<QuantityResult> {
  const user = await requireFamilyUser();

  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: false, error: "Cantidad inválida." };
  }

  const product = await findProduct(user.familyId, productId);
  if (!product) return { ok: false, error: "No encontramos ese producto." };

  const next = Math.max(0, round3(product.quantity + round3(delta)));
  const applied = round3(next - product.quantity);

  if (applied === 0) {
    return { ok: true, quantity: product.quantity };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ quantity: next, updatedAt: new Date() })
      .where(eq(products.id, productId));

    await tx.insert(movements).values({
      productId,
      userId: user.id,
      userName: user.name,
      kind: applied > 0 ? "REPOSICION" : "CONSUMO",
      delta: applied,
      resulting: next,
    });
  });

  return { ok: true, quantity: next };
}

/** Fija una cantidad exacta (por ejemplo después de contar lo que hay). */
export async function setQuantityAction(
  productId: string,
  value: number,
): Promise<QuantityResult> {
  const user = await requireFamilyUser();

  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, error: "Cantidad inválida." };
  }

  const product = await findProduct(user.familyId, productId);
  if (!product) return { ok: false, error: "No encontramos ese producto." };

  const next = round3(value);
  const delta = round3(next - product.quantity);

  if (delta === 0) return { ok: true, quantity: product.quantity };

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ quantity: next, updatedAt: new Date() })
      .where(eq(products.id, productId));

    await tx.insert(movements).values({
      productId,
      userId: user.id,
      userName: user.name,
      kind: "AJUSTE",
      delta,
      resulting: next,
      note: "Cantidad corregida a mano",
    });
  });

  return { ok: true, quantity: next };
}

/** Reordena compartimientos o muebles arrastrando en la interfaz. */
export async function moveSortOrderAction(
  entity: "sector" | "furniture" | "compartment",
  id: string,
  direction: "up" | "down",
): Promise<ActionState> {
  const user = await requireFamilyUser();
  const shift = direction === "up" ? -1 : 1;

  if (entity === "sector") {
    if (!(await findSector(user.familyId, id))) return fail("No encontramos ese sector.");
    await db
      .update(sectors)
      .set({ sortOrder: sql`${sectors.sortOrder} + ${shift}` })
      .where(eq(sectors.id, id));
  } else if (entity === "furniture") {
    if (!(await findFurniture(user.familyId, id))) return fail("No encontramos ese mueble.");
    await db
      .update(furnitures)
      .set({ sortOrder: sql`${furnitures.sortOrder} + ${shift}` })
      .where(eq(furnitures.id, id));
  } else {
    if (!(await findCompartment(user.familyId, id))) {
      return fail("No encontramos ese compartimiento.");
    }
    await db
      .update(compartments)
      .set({ sortOrder: sql`${compartments.sortOrder} + ${shift}` })
      .where(eq(compartments.id, id));
  }

  refresh();
  return done();
}

/** Últimos movimientos de un producto, para el historial del modal. */
export async function productHistoryAction(productId: string): Promise<{
  ok: boolean;
  error?: string;
  items?: {
    id: string;
    userName: string;
    kind: string;
    delta: number;
    resulting: number;
    note: string | null;
    createdAt: string;
  }[];
}> {
  const user = await requireFamilyUser();

  if (!(await findProduct(user.familyId, productId))) {
    return { ok: false, error: "No encontramos ese producto." };
  }

  const rows = await db
    .select()
    .from(movements)
    .where(eq(movements.productId, productId))
    .orderBy(desc(movements.createdAt))
    .limit(30);

  return {
    ok: true,
    items: rows.map((row) => ({
      id: row.id,
      userName: row.userName,
      kind: row.kind,
      delta: row.delta,
      resulting: row.resulting,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
