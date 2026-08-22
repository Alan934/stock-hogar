import "server-only";

import { and, asc, desc, eq, ilike, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  compartments,
  families,
  furnitures,
  intakeBatches,
  intakeLines,
  movements,
  products,
  sectors,
  shoppingItems,
  stockEntries,
  users,
  type Unit,
} from "@/lib/db/schema";

/* ------------------------------------------------------------------ */
/* Piezas reusables                                                    */
/* ------------------------------------------------------------------ */

/** Total de cada producto sumando todos los lugares donde está guardado. */
const totals = db
  .select({
    productId: stockEntries.productId,
    total: sql<number>`sum(${stockEntries.quantity})::float8`.as("total"),
    locations: sql<number>`count(*)::int`.as("locations"),
  })
  .from(stockEntries)
  .groupBy(stockEntries.productId)
  .as("totals");

/** Falta en la casa: el total no llega al mínimo del producto. */
const missingInHouse = sql<boolean>`(
  ${products.minQuantity} > 0
  and coalesce(${totals.total}, 0) <= ${products.minQuantity}
)`;

/** Falta en este lugar: la existencia no llega al mínimo propio. */
const missingHere = sql<boolean>`(
  ${stockEntries.minQuantity} is not null
  and ${stockEntries.minQuantity} > 0
  and ${stockEntries.quantity} <= ${stockEntries.minQuantity}
)`;

/** Cuenta las existencias que piden atención, por cualquiera de los dos motivos. */
const needsAttention = sql<number>`count(*) filter (where (
  ${stockEntries.minQuantity} is not null
    and ${stockEntries.minQuantity} > 0
    and ${stockEntries.quantity} <= ${stockEntries.minQuantity}
) or (
  ${products.minQuantity} > 0
    and coalesce(${totals.total}, 0) <= ${products.minQuantity}
))::int`;

export type ProductInfo = {
  id: string;
  name: string;
  unit: Unit;
  step: number;
  minQuantity: number;
  notes: string | null;
};

export type StockCardData = {
  id: string;
  quantity: number;
  minQuantity: number | null;
  expiresAt: string | null;
  note: string | null;
  compartmentId: string;
  product: ProductInfo;
  /** Suma de todos los lugares donde está este producto. */
  total: number;
  /** En cuántos lugares está guardado. */
  locations: number;
};

const stockSelection = {
  id: stockEntries.id,
  quantity: stockEntries.quantity,
  minQuantity: stockEntries.minQuantity,
  expiresAt: stockEntries.expiresAt,
  note: stockEntries.note,
  compartmentId: stockEntries.compartmentId,
  productId: products.id,
  productName: products.name,
  productUnit: products.unit,
  productStep: products.step,
  productMin: products.minQuantity,
  productNotes: products.notes,
  total: sql<number>`coalesce(${totals.total}, ${stockEntries.quantity})::float8`,
  locations: sql<number>`coalesce(${totals.locations}, 1)::int`,
};

function toCard(row: {
  id: string;
  quantity: number;
  minQuantity: number | null;
  expiresAt: string | null;
  note: string | null;
  compartmentId: string;
  productId: string;
  productName: string;
  productUnit: Unit;
  productStep: number;
  productMin: number;
  productNotes: string | null;
  total: number;
  locations: number;
}): StockCardData {
  return {
    id: row.id,
    quantity: row.quantity,
    minQuantity: row.minQuantity,
    expiresAt: row.expiresAt,
    note: row.note,
    compartmentId: row.compartmentId,
    total: row.total,
    locations: row.locations,
    product: {
      id: row.productId,
      name: row.productName,
      unit: row.productUnit,
      step: row.productStep,
      minQuantity: row.productMin,
      notes: row.productNotes,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Sectores y muebles                                                  */
/* ------------------------------------------------------------------ */

export async function getSectorsWithStats(familyId: string) {
  return db
    .select({
      id: sectors.id,
      name: sectors.name,
      icon: sectors.icon,
      sortOrder: sectors.sortOrder,
      furnitureCount: sql<number>`count(distinct ${furnitures.id})::int`,
      productCount: sql<number>`count(distinct ${products.id})::int`,
      lowCount: needsAttention,
    })
    .from(sectors)
    .leftJoin(furnitures, eq(furnitures.sectorId, sectors.id))
    .leftJoin(compartments, eq(compartments.furnitureId, furnitures.id))
    .leftJoin(stockEntries, eq(stockEntries.compartmentId, compartments.id))
    .leftJoin(products, eq(products.id, stockEntries.productId))
    .leftJoin(totals, eq(totals.productId, products.id))
    .where(eq(sectors.familyId, familyId))
    .groupBy(sectors.id)
    .orderBy(asc(sectors.sortOrder), asc(sectors.name));
}

export async function getSector(familyId: string, sectorId: string) {
  const [sector] = await db
    .select()
    .from(sectors)
    .where(and(eq(sectors.id, sectorId), eq(sectors.familyId, familyId)))
    .limit(1);
  return sector ?? null;
}

export async function getFurnituresWithStats(sectorId: string) {
  return db
    .select({
      id: furnitures.id,
      name: furnitures.name,
      qrToken: furnitures.qrToken,
      sortOrder: furnitures.sortOrder,
      compartmentCount: sql<number>`count(distinct ${compartments.id})::int`,
      productCount: sql<number>`count(distinct ${products.id})::int`,
      lowCount: needsAttention,
    })
    .from(furnitures)
    .leftJoin(compartments, eq(compartments.furnitureId, furnitures.id))
    .leftJoin(stockEntries, eq(stockEntries.compartmentId, compartments.id))
    .leftJoin(products, eq(products.id, stockEntries.productId))
    .leftJoin(totals, eq(totals.productId, products.id))
    .where(eq(furnitures.sectorId, sectorId))
    .groupBy(furnitures.id)
    .orderBy(asc(furnitures.sortOrder), asc(furnitures.name));
}

/** Mueble completo con sus compartimientos y lo que hay guardado en cada uno. */
export async function getFurnitureDetail(familyId: string, furnitureId: string) {
  const [furniture] = await db
    .select({
      id: furnitures.id,
      name: furnitures.name,
      qrToken: furnitures.qrToken,
      sectorId: sectors.id,
      sectorName: sectors.name,
      familyId: sectors.familyId,
    })
    .from(furnitures)
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(eq(furnitures.id, furnitureId))
    .limit(1);

  if (!furniture || furniture.familyId !== familyId) return null;

  const compartmentRows = await db
    .select()
    .from(compartments)
    .where(eq(compartments.furnitureId, furniture.id))
    .orderBy(asc(compartments.sortOrder), asc(compartments.name));

  const stockRows = compartmentRows.length
    ? await db
        .select(stockSelection)
        .from(stockEntries)
        .innerJoin(products, eq(products.id, stockEntries.productId))
        .innerJoin(compartments, eq(compartments.id, stockEntries.compartmentId))
        .leftJoin(totals, eq(totals.productId, products.id))
        .where(eq(compartments.furnitureId, furniture.id))
        .orderBy(asc(products.name))
    : [];

  const byCompartment = new Map<string, StockCardData[]>();
  for (const row of stockRows) {
    const card = toCard(row);
    const list = byCompartment.get(card.compartmentId) ?? [];
    list.push(card);
    byCompartment.set(card.compartmentId, list);
  }

  return {
    ...furniture,
    compartments: compartmentRows.map((compartment) => ({
      ...compartment,
      items: byCompartment.get(compartment.id) ?? [],
    })),
  };
}

export async function getFurnitureIdByToken(token: string) {
  const [row] = await db
    .select({ id: furnitures.id, familyId: sectors.familyId })
    .from(furnitures)
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(eq(furnitures.qrToken, token))
    .limit(1);
  return row ?? null;
}

/** Todos los muebles de la familia, para la hoja de códigos QR. */
export async function getAllFurnitures(familyId: string) {
  return db
    .select({
      id: furnitures.id,
      name: furnitures.name,
      qrToken: furnitures.qrToken,
      sectorName: sectors.name,
      sectorId: sectors.id,
    })
    .from(furnitures)
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(eq(sectors.familyId, familyId))
    .orderBy(asc(sectors.sortOrder), asc(sectors.name), asc(furnitures.name));
}

/** Todos los compartimientos de la familia, para elegir dónde guardar. */
export async function getAllCompartments(familyId: string) {
  return db
    .select({
      id: compartments.id,
      name: compartments.name,
      furnitureName: furnitures.name,
      sectorName: sectors.name,
    })
    .from(compartments)
    .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(eq(sectors.familyId, familyId))
    .orderBy(asc(sectors.sortOrder), asc(furnitures.name), asc(compartments.name));
}

/* ------------------------------------------------------------------ */
/* Catálogo                                                            */
/* ------------------------------------------------------------------ */

const catalogSelection = {
  id: products.id,
  name: products.name,
  unit: products.unit,
  step: products.step,
  minQuantity: products.minQuantity,
  notes: products.notes,
  defaultCompartmentId: products.defaultCompartmentId,
  total: sql<number>`coalesce(${totals.total}, 0)::float8`,
  locations: sql<number>`coalesce(${totals.locations}, 0)::int`,
};

export type CatalogItem = {
  id: string;
  name: string;
  unit: Unit;
  step: number;
  minQuantity: number;
  notes: string | null;
  defaultCompartmentId: string | null;
  total: number;
  locations: number;
};

/** Catálogo completo: lo que alimenta el buscador al agregar a un mueble. */
export async function getCatalog(familyId: string): Promise<CatalogItem[]> {
  return db
    .select(catalogSelection)
    .from(products)
    .leftJoin(totals, eq(totals.productId, products.id))
    .where(eq(products.familyId, familyId))
    .orderBy(asc(products.name));
}

export async function searchCatalog(familyId: string, term: string) {
  const clean = term.trim();
  if (!clean) return [];

  return db
    .select(catalogSelection)
    .from(products)
    .leftJoin(totals, eq(totals.productId, products.id))
    .where(and(eq(products.familyId, familyId), ilike(products.name, `%${clean}%`)))
    .orderBy(asc(products.name))
    .limit(60);
}

/** Un producto con el detalle de dónde está repartido. */
export async function getProductDetail(familyId: string, productId: string) {
  const [product] = await db
    .select(catalogSelection)
    .from(products)
    .leftJoin(totals, eq(totals.productId, products.id))
    .where(and(eq(products.id, productId), eq(products.familyId, familyId)))
    .limit(1);

  if (!product) return null;

  const locations = await db
    .select({
      id: stockEntries.id,
      quantity: stockEntries.quantity,
      minQuantity: stockEntries.minQuantity,
      expiresAt: stockEntries.expiresAt,
      note: stockEntries.note,
      compartmentId: compartments.id,
      compartmentName: compartments.name,
      furnitureId: furnitures.id,
      furnitureName: furnitures.name,
      sectorName: sectors.name,
    })
    .from(stockEntries)
    .innerJoin(compartments, eq(compartments.id, stockEntries.compartmentId))
    .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(eq(stockEntries.productId, productId))
    .orderBy(asc(sectors.name), asc(furnitures.name), asc(compartments.name));

  const history = await db
    .select()
    .from(movements)
    .where(eq(movements.productId, productId))
    .orderBy(desc(movements.createdAt))
    .limit(40);

  return { product, locations, history };
}

/* ------------------------------------------------------------------ */
/* Avisos                                                              */
/* ------------------------------------------------------------------ */

/** Falta en la casa: hay que comprar. */
export async function getShoppingList(familyId: string, limit = 30) {
  return db
    .select(catalogSelection)
    .from(products)
    .leftJoin(totals, eq(totals.productId, products.id))
    .where(and(eq(products.familyId, familyId), missingInHouse))
    .orderBy(asc(products.name))
    .limit(limit);
}

/** Falta en un lugar puntual, aunque en la casa haya de sobra. */
export async function getRefillList(familyId: string, limit = 30) {
  const rows = await db
    .select({
      ...stockSelection,
      compartmentName: compartments.name,
      furnitureId: furnitures.id,
      furnitureName: furnitures.name,
      sectorName: sectors.name,
    })
    .from(stockEntries)
    .innerJoin(products, eq(products.id, stockEntries.productId))
    .innerJoin(compartments, eq(compartments.id, stockEntries.compartmentId))
    .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .leftJoin(totals, eq(totals.productId, products.id))
    .where(
      and(eq(sectors.familyId, familyId), isNotNull(stockEntries.minQuantity), missingHere),
    )
    .orderBy(asc(products.name))
    .limit(limit);

  return rows.map((row) => ({
    ...toCard(row),
    compartmentName: row.compartmentName,
    furnitureId: row.furnitureId,
    furnitureName: row.furnitureName,
    sectorName: row.sectorName,
  }));
}

export async function getFamilyStats(familyId: string) {
  const [structure] = await db
    .select({
      sectorCount: sql<number>`count(distinct ${sectors.id})::int`,
      furnitureCount: sql<number>`count(distinct ${furnitures.id})::int`,
    })
    .from(sectors)
    .leftJoin(furnitures, eq(furnitures.sectorId, sectors.id))
    .where(eq(sectors.familyId, familyId));

  const [catalog] = await db
    .select({
      productCount: sql<number>`count(*)::int`,
      buyCount: sql<number>`count(*) filter (where ${missingInHouse})::int`,
    })
    .from(products)
    .leftJoin(totals, eq(totals.productId, products.id))
    .where(eq(products.familyId, familyId));

  const [refill] = await db
    .select({ refillCount: sql<number>`count(*)::int` })
    .from(stockEntries)
    .innerJoin(compartments, eq(compartments.id, stockEntries.compartmentId))
    .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(and(eq(sectors.familyId, familyId), missingHere));

  return {
    sectorCount: structure?.sectorCount ?? 0,
    furnitureCount: structure?.furnitureCount ?? 0,
    productCount: catalog?.productCount ?? 0,
    buyCount: catalog?.buyCount ?? 0,
    refillCount: refill?.refillCount ?? 0,
  };
}

export async function getRecentMovements(familyId: string, limit = 12) {
  return db
    .select({
      id: movements.id,
      delta: movements.delta,
      resulting: movements.resulting,
      kind: movements.kind,
      userName: movements.userName,
      locationName: movements.locationName,
      createdAt: movements.createdAt,
      productId: products.id,
      productName: products.name,
      unit: products.unit,
    })
    .from(movements)
    .innerJoin(products, eq(products.id, movements.productId))
    .where(eq(products.familyId, familyId))
    .orderBy(desc(movements.createdAt))
    .limit(limit);
}

/* ------------------------------------------------------------------ */
/* Administración                                                      */
/* ------------------------------------------------------------------ */

export async function getAllFamilies() {
  return db
    .select({
      id: families.id,
      name: families.name,
      createdAt: families.createdAt,
      memberCount: sql<number>`count(${users.id})::int`,
    })
    .from(families)
    .leftJoin(users, eq(users.familyId, families.id))
    .groupBy(families.id)
    .orderBy(asc(families.name));
}

export async function getAllUsers() {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      familyId: users.familyId,
      familyName: families.name,
    })
    .from(users)
    .leftJoin(families, eq(families.id, users.familyId))
    .orderBy(asc(users.name));
}

export async function countUsers() {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users);
  return row?.total ?? 0;
}

export async function getFamily(familyId: string) {
  const [family] = await db
    .select()
    .from(families)
    .where(eq(families.id, familyId))
    .limit(1);
  return family ?? null;
}

export async function getFamilyMembers(familyId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.familyId, familyId))
    .orderBy(asc(users.name));
}

/* ------------------------------------------------------------------ */
/* Lista de compras                                                    */
/* ------------------------------------------------------------------ */

/** Ítems escritos a mano, los pendientes primero. */
export async function getShoppingItems(familyId: string) {
  return db
    .select()
    .from(shoppingItems)
    .where(eq(shoppingItems.familyId, familyId))
    .orderBy(asc(shoppingItems.done), asc(shoppingItems.createdAt));
}

/** Dónde está guardado cada uno de estos productos (para "ya lo compré"). */
export async function getPlacesForProducts(
  familyId: string,
  productIds: string[],
) {
  if (productIds.length === 0) return new Map<string, string>();

  const rows = await db
    .select({
      productId: stockEntries.productId,
      compartmentId: compartments.id,
    })
    .from(stockEntries)
    .innerJoin(compartments, eq(compartments.id, stockEntries.compartmentId))
    .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(
      and(
        eq(sectors.familyId, familyId),
        inArray(stockEntries.productId, productIds),
      ),
    )
    .orderBy(desc(stockEntries.quantity));

  // Nos quedamos con el lugar donde más hay: es el destino más probable.
  const byProduct = new Map<string, string>();
  for (const row of rows) {
    if (!byProduct.has(row.productId)) {
      byProduct.set(row.productId, row.compartmentId);
    }
  }
  return byProduct;
}

/* ------------------------------------------------------------------ */
/* Carga en lote                                                       */
/* ------------------------------------------------------------------ */

export type IntakeLineData = {
  id: string;
  productId: string | null;
  /** Lo que dijo la fuente. Se muestra cuando el producto está sin resolver. */
  rawLabel: string;
  quantity: number;
  compartmentId: string | null;
  expiresAt: string | null;
  note: string | null;
  skipped: boolean;
  sortOrder: number;
  productName: string | null;
  productUnit: Unit | null;
  productStep: number | null;
  /** Cuánto hay hoy en toda la casa, para saber si vale la pena guardarlo. */
  total: number;
};

/** El borrador abierto de la familia, si hay uno a medio revisar. */
export async function getOpenIntakeBatch(familyId: string) {
  // Con join y group by en vez de subconsulta correlacionada: adentro de una
  // subconsulta Drizzle no califica los nombres y la comparación sale mal.
  const [batch] = await db
    .select({
      id: intakeBatches.id,
      createdAt: intakeBatches.createdAt,
      createdByName: intakeBatches.createdByName,
      lineCount: sql<number>`count(${intakeLines.id}) filter (
        where ${intakeLines.skipped} = false
      )::int`,
    })
    .from(intakeBatches)
    .leftJoin(intakeLines, eq(intakeLines.batchId, intakeBatches.id))
    .where(
      and(
        eq(intakeBatches.familyId, familyId),
        eq(intakeBatches.status, "BORRADOR"),
      ),
    )
    .groupBy(intakeBatches.id)
    .orderBy(desc(intakeBatches.createdAt))
    .limit(1);

  return batch ?? null;
}

/** El lote completo con sus renglones, validando que sea de la familia. */
export async function getIntakeBatch(familyId: string, batchId: string) {
  const [batch] = await db
    .select()
    .from(intakeBatches)
    .where(
      and(eq(intakeBatches.id, batchId), eq(intakeBatches.familyId, familyId)),
    )
    .limit(1);

  if (!batch) return null;

  const lines: IntakeLineData[] = await db
    .select({
      id: intakeLines.id,
      productId: intakeLines.productId,
      rawLabel: intakeLines.rawLabel,
      quantity: intakeLines.quantity,
      compartmentId: intakeLines.compartmentId,
      expiresAt: intakeLines.expiresAt,
      note: intakeLines.note,
      skipped: intakeLines.skipped,
      sortOrder: intakeLines.sortOrder,
      productName: products.name,
      productUnit: products.unit,
      productStep: products.step,
      total: sql<number>`coalesce(${totals.total}, 0)::float8`,
    })
    .from(intakeLines)
    .leftJoin(products, eq(products.id, intakeLines.productId))
    .leftJoin(totals, eq(totals.productId, products.id))
    .where(eq(intakeLines.batchId, batch.id))
    .orderBy(asc(intakeLines.sortOrder), asc(intakeLines.createdAt));

  return { batch, lines };
}
