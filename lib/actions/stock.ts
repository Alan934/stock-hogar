"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ilike, sql } from "drizzle-orm";

import { requireFamilyUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  compartments,
  furnitures,
  movements,
  products,
  sectors,
  stockEntries,
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
  const raw = String(formData.get(key) ?? "")
    .replace(",", ".")
    .trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? round3(parsed) : fallback;
}

/** Igual que numberOr pero deja distinguir "vacío" de "cero". */
function optionalNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "")
    .replace(",", ".")
    .trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, round3(parsed)) : null;
}

function readUnit(formData: FormData): Unit {
  const raw = String(formData.get("unit") ?? "UNIDAD");
  return (unitEnum.enumValues as readonly string[]).includes(raw)
    ? (raw as Unit)
    : "UNIDAD";
}

function onlyAdmin(user: User) {
  return user.role === "ADMIN"
    ? null
    : fail(
        "Sólo el administrador puede eliminar. Pedile a quien administra la casa.",
      );
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
    .select({
      compartment: compartments,
      familyId: sectors.familyId,
      furnitureName: furnitures.name,
    })
    .from(compartments)
    .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(eq(compartments.id, compartmentId))
    .limit(1);

  if (!row || row.familyId !== familyId) return null;
  return {
    ...row.compartment,
    locationName: `${row.furnitureName} · ${row.compartment.name}`,
  };
}

async function findProduct(familyId: string, productId: string) {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.familyId, familyId)))
    .limit(1);
  return row ?? null;
}

/** Existencia + su producto + el nombre del lugar, validando la familia. */
async function findStock(familyId: string, stockId: string) {
  const [row] = await db
    .select({
      stock: stockEntries,
      product: products,
      familyId: sectors.familyId,
      compartmentName: compartments.name,
      furnitureName: furnitures.name,
    })
    .from(stockEntries)
    .innerJoin(products, eq(products.id, stockEntries.productId))
    .innerJoin(compartments, eq(compartments.id, stockEntries.compartmentId))
    .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(eq(stockEntries.id, stockId))
    .limit(1);

  if (!row || row.familyId !== familyId) return null;
  return {
    ...row,
    locationName: `${row.furnitureName} · ${row.compartmentName}`,
  };
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
  if (!(await findSector(user.familyId, id)))
    return fail("No encontramos ese sector.");

  await db.update(sectors).set({ name, icon }).where(eq(sectors.id, id));
  refresh();
  return done("Sector actualizado.");
}

export async function deleteSectorAction(id: string): Promise<ActionState> {
  const user = await requireFamilyUser();
  const denied = onlyAdmin(user);
  if (denied) return denied;

  if (!(await findSector(user.familyId, id)))
    return fail("No encontramos ese sector.");

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
  if (!(await findFurniture(user.familyId, id)))
    return fail("No encontramos ese mueble.");

  await db.update(furnitures).set({ name }).where(eq(furnitures.id, id));
  refresh();
  return done("Mueble actualizado.");
}

export async function deleteFurnitureAction(id: string): Promise<ActionState> {
  const user = await requireFamilyUser();
  const denied = onlyAdmin(user);
  if (denied) return denied;

  if (!(await findFurniture(user.familyId, id)))
    return fail("No encontramos ese mueble.");

  await db.delete(furnitures).where(eq(furnitures.id, id));
  refresh();
  return done("Mueble eliminado.");
}

/** Genera un token nuevo: el QR viejo deja de funcionar. */
export async function regenerateQrAction(id: string): Promise<ActionState> {
  const user = await requireFamilyUser();
  const denied = onlyAdmin(user);
  if (denied) return denied;

  if (!(await findFurniture(user.familyId, id)))
    return fail("No encontramos ese mueble.");

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

export async function deleteCompartmentAction(
  id: string,
): Promise<ActionState> {
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
/* Catálogo de productos                                               */
/* ------------------------------------------------------------------ */

/**
 * Crea un producto del catálogo (el "qué es") y, si le pasás un
 * compartimiento, además lo guarda ahí con su cantidad inicial.
 */
export async function createProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireFamilyUser();
  const name = text(formData, "name");
  const unit = readUnit(formData);

  if (!name) return fail("Poné un nombre para el producto.");

  const duplicated = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(and(eq(products.familyId, user.familyId), ilike(products.name, name)))
    .limit(1);

  if (duplicated.length) {
    return fail(
      `Ya tenés "${duplicated[0].name}" en el catálogo: elegilo de la lista en vez de crearlo de nuevo.`,
    );
  }

  const compartmentId = text(formData, "compartmentId");
  const compartment = compartmentId
    ? await findCompartment(user.familyId, compartmentId)
    : null;

  if (compartmentId && !compartment) {
    return fail("No encontramos ese compartimiento.");
  }

  const step = Math.max(
    0.001,
    numberOr(formData, "step", unitInfo(unit).defaultStep),
  );
  const quantity = Math.max(0, numberOr(formData, "quantity", 0));

  await db.transaction(async (tx) => {
    const [product] = await tx
      .insert(products)
      .values({
        familyId: user.familyId,
        name,
        unit,
        step,
        minQuantity: Math.max(0, numberOr(formData, "minQuantity", 0)),
        notes: text(formData, "notes") || null,
        createdById: user.id,
      })
      .returning();

    if (!compartment) return;

    await tx.insert(stockEntries).values({
      productId: product.id,
      compartmentId: compartment.id,
      quantity,
      minQuantity: optionalNumber(formData, "locationMin"),
      expiresAt: text(formData, "expiresAt") || null,
    });

    await tx.insert(movements).values({
      productId: product.id,
      compartmentId: compartment.id,
      locationName: compartment.locationName,
      userId: user.id,
      userName: user.name,
      kind: "ALTA",
      delta: quantity,
      resulting: quantity,
      note: "Producto agregado",
    });
  });

  refresh();
  return done(`"${name}" agregado.`);
}

/** Edita los datos del catálogo: valen para todos los lugares a la vez. */
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

  const duplicated = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.familyId, user.familyId), ilike(products.name, name)))
    .limit(1);

  if (duplicated.length && duplicated[0].id !== id) {
    return fail(`Ya tenés otro producto llamado "${name}".`);
  }

  await db
    .update(products)
    .set({
      name,
      unit: readUnit(formData),
      step: Math.max(0.001, numberOr(formData, "step", current.step)),
      minQuantity: Math.max(
        0,
        numberOr(formData, "minQuantity", current.minQuantity),
      ),
      notes: text(formData, "notes") || null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));

  refresh();
  return done("Producto actualizado.");
}

/** Elimina el producto del catálogo y de todos los lugares donde estaba. */
export async function deleteProductAction(id: string): Promise<ActionState> {
  const user = await requireFamilyUser();
  const denied = onlyAdmin(user);
  if (denied) return denied;

  const product = await findProduct(user.familyId, id);
  if (!product) return fail("No encontramos ese producto.");

  await db.delete(products).where(eq(products.id, id));
  refresh();
  return done(`"${product.name}" eliminado de toda la casa.`);
}

/* ------------------------------------------------------------------ */
/* Existencias (producto + lugar)                                      */
/* ------------------------------------------------------------------ */

/**
 * Guarda en un compartimiento un producto que ya está en el catálogo. Si ese
 * producto ya estaba en ese mismo lugar, le suma la cantidad.
 */
export async function addStockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireFamilyUser();
  const productId = text(formData, "productId");
  const compartmentId = text(formData, "compartmentId");

  const product = await findProduct(user.familyId, productId);
  if (!product) return fail("No encontramos ese producto.");

  const compartment = await findCompartment(user.familyId, compartmentId);
  if (!compartment) return fail("No encontramos ese compartimiento.");

  const quantity = Math.max(0, numberOr(formData, "quantity", 0));
  const locationMin = optionalNumber(formData, "locationMin");
  const expiresAt = text(formData, "expiresAt") || null;
  const note = text(formData, "note") || null;

  const [existing] = await db
    .select()
    .from(stockEntries)
    .where(
      and(
        eq(stockEntries.productId, productId),
        eq(stockEntries.compartmentId, compartmentId),
      ),
    )
    .limit(1);

  const resulting = round3((existing?.quantity ?? 0) + quantity);

  await db.transaction(async (tx) => {
    if (existing) {
      await tx
        .update(stockEntries)
        .set({
          quantity: resulting,
          minQuantity: locationMin ?? existing.minQuantity,
          expiresAt: expiresAt ?? existing.expiresAt,
          note: note ?? existing.note,
          updatedAt: new Date(),
        })
        .where(eq(stockEntries.id, existing.id));
    } else {
      await tx.insert(stockEntries).values({
        productId,
        compartmentId,
        quantity,
        minQuantity: locationMin,
        expiresAt,
        note,
      });
    }

    await tx.insert(movements).values({
      productId,
      compartmentId,
      locationName: compartment.locationName,
      userId: user.id,
      userName: user.name,
      kind: existing ? "REPOSICION" : "ALTA",
      delta: quantity,
      resulting,
      note: existing ? null : "Guardado acá por primera vez",
    });
  });

  refresh();
  return done(
    existing
      ? `Sumado a "${product.name}" en ${compartment.name}.`
      : `"${product.name}" guardado en ${compartment.name}.`,
  );
}

/** Ajustes propios del lugar: su mínimo, el vencimiento y la nota. */
export async function updateStockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireFamilyUser();
  const id = text(formData, "id");

  const found = await findStock(user.familyId, id);
  if (!found) return fail("No encontramos ese producto en ese lugar.");

  await db
    .update(stockEntries)
    .set({
      minQuantity: optionalNumber(formData, "locationMin"),
      expiresAt: text(formData, "expiresAt") || null,
      note: text(formData, "note") || null,
      updatedAt: new Date(),
    })
    .where(eq(stockEntries.id, id));

  refresh();
  return done("Listo.");
}

/** Saca el producto de este lugar, pero lo deja en el catálogo. */
export async function removeStockAction(id: string): Promise<ActionState> {
  const user = await requireFamilyUser();
  const denied = onlyAdmin(user);
  if (denied) return denied;

  const found = await findStock(user.familyId, id);
  if (!found) return fail("No encontramos ese producto en ese lugar.");

  await db.delete(stockEntries).where(eq(stockEntries.id, id));
  refresh();
  return done(
    `"${found.product.name}" ya no figura en ${found.compartmentName}. Sigue en el catálogo.`,
  );
}

/**
 * Suma o resta en un lugar. Es la operación más usada de toda la app: la hace
 * cualquier integrante de la familia desde los botones + / -.
 */
export async function adjustQuantityAction(
  stockId: string,
  delta: number,
): Promise<QuantityResult> {
  const user = await requireFamilyUser();

  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: false, error: "Cantidad inválida." };
  }

  const found = await findStock(user.familyId, stockId);
  if (!found) return { ok: false, error: "No encontramos ese producto." };

  const next = Math.max(0, round3(found.stock.quantity + round3(delta)));
  const applied = round3(next - found.stock.quantity);

  if (applied === 0) return { ok: true, quantity: found.stock.quantity };

  await db.transaction(async (tx) => {
    await tx
      .update(stockEntries)
      .set({ quantity: next, updatedAt: new Date() })
      .where(eq(stockEntries.id, stockId));

    await tx.insert(movements).values({
      productId: found.product.id,
      compartmentId: found.stock.compartmentId,
      locationName: found.locationName,
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
  stockId: string,
  value: number,
): Promise<QuantityResult> {
  const user = await requireFamilyUser();

  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, error: "Cantidad inválida." };
  }

  const found = await findStock(user.familyId, stockId);
  if (!found) return { ok: false, error: "No encontramos ese producto." };

  const next = round3(value);
  const delta = round3(next - found.stock.quantity);

  if (delta === 0) return { ok: true, quantity: found.stock.quantity };

  await db.transaction(async (tx) => {
    await tx
      .update(stockEntries)
      .set({ quantity: next, updatedAt: new Date() })
      .where(eq(stockEntries.id, stockId));

    await tx.insert(movements).values({
      productId: found.product.id,
      compartmentId: found.stock.compartmentId,
      locationName: found.locationName,
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

/** Pasa una cantidad de un lugar a otro, por ejemplo del freezer a la heladera. */
export async function moveStockAction(
  stockId: string,
  targetCompartmentId: string,
  amount: number,
): Promise<ActionState> {
  const user = await requireFamilyUser();

  const origin = await findStock(user.familyId, stockId);
  if (!origin) return fail("No encontramos ese producto en ese lugar.");

  const target = await findCompartment(user.familyId, targetCompartmentId);
  if (!target) return fail("No encontramos el lugar de destino.");
  if (target.id === origin.stock.compartmentId) {
    return fail("Elegí un lugar distinto al actual.");
  }

  const moved = round3(Math.min(Math.max(0, amount), origin.stock.quantity));
  if (!Number.isFinite(moved) || moved <= 0) {
    return fail("Poné una cantidad mayor a cero.");
  }

  const [existingTarget] = await db
    .select()
    .from(stockEntries)
    .where(
      and(
        eq(stockEntries.productId, origin.product.id),
        eq(stockEntries.compartmentId, target.id),
      ),
    )
    .limit(1);

  const originLeft = round3(origin.stock.quantity - moved);
  const targetTotal = round3((existingTarget?.quantity ?? 0) + moved);

  await db.transaction(async (tx) => {
    await tx
      .update(stockEntries)
      .set({ quantity: originLeft, updatedAt: new Date() })
      .where(eq(stockEntries.id, stockId));

    if (existingTarget) {
      await tx
        .update(stockEntries)
        .set({ quantity: targetTotal, updatedAt: new Date() })
        .where(eq(stockEntries.id, existingTarget.id));
    } else {
      await tx.insert(stockEntries).values({
        productId: origin.product.id,
        compartmentId: target.id,
        quantity: moved,
      });
    }

    await tx.insert(movements).values([
      {
        productId: origin.product.id,
        compartmentId: origin.stock.compartmentId,
        locationName: origin.locationName,
        userId: user.id,
        userName: user.name,
        kind: "TRASLADO",
        delta: -moved,
        resulting: originLeft,
        note: `Movido a ${target.locationName}`,
      },
      {
        productId: origin.product.id,
        compartmentId: target.id,
        locationName: target.locationName,
        userId: user.id,
        userName: user.name,
        kind: "TRASLADO",
        delta: moved,
        resulting: targetTotal,
        note: `Traído de ${origin.locationName}`,
      },
    ]);
  });

  refresh();
  return done(`Movido a ${target.name}.`);
}

/** Historial completo del producto, con todos sus lugares mezclados. */
export async function productHistoryAction(productId: string): Promise<{
  ok: boolean;
  error?: string;
  items?: {
    id: string;
    userName: string;
    locationName: string;
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
    .orderBy(sql`${movements.createdAt} desc`)
    .limit(30);

  return {
    ok: true,
    items: rows.map((row) => ({
      id: row.id,
      userName: row.userName,
      locationName: row.locationName,
      kind: row.kind,
      delta: row.delta,
      resulting: row.resulting,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
