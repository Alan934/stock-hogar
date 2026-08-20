import "server-only";

import { and, asc, desc, eq, gt, ilike, lte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  compartments,
  families,
  furnitures,
  movements,
  products,
  sectors,
  users,
} from "@/lib/db/schema";

/* ------------------------------------------------------------------ */
/* Sectores                                                            */
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
      lowCount: sql<number>`count(distinct ${products.id}) filter (
        where ${products.minQuantity} > 0
          and ${products.quantity} <= ${products.minQuantity}
      )::int`,
    })
    .from(sectors)
    .leftJoin(furnitures, eq(furnitures.sectorId, sectors.id))
    .leftJoin(compartments, eq(compartments.furnitureId, furnitures.id))
    .leftJoin(products, eq(products.compartmentId, compartments.id))
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
      lowCount: sql<number>`count(distinct ${products.id}) filter (
        where ${products.minQuantity} > 0
          and ${products.quantity} <= ${products.minQuantity}
      )::int`,
    })
    .from(furnitures)
    .leftJoin(compartments, eq(compartments.furnitureId, furnitures.id))
    .leftJoin(products, eq(products.compartmentId, compartments.id))
    .where(eq(furnitures.sectorId, sectorId))
    .groupBy(furnitures.id)
    .orderBy(asc(furnitures.sortOrder), asc(furnitures.name));
}

/* ------------------------------------------------------------------ */
/* Muebles                                                             */
/* ------------------------------------------------------------------ */

/** Mueble completo con sus compartimientos y productos, validando la familia. */
export async function getFurnitureDetail(familyId: string, furnitureId: string) {
  const furniture = await db.query.furnitures.findFirst({
    where: eq(furnitures.id, furnitureId),
    with: {
      sector: true,
      compartments: {
        orderBy: [asc(compartments.sortOrder), asc(compartments.name)],
        with: {
          products: {
            orderBy: [asc(products.name)],
          },
        },
      },
    },
  });

  if (!furniture || furniture.sector.familyId !== familyId) return null;
  return furniture;
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

/* ------------------------------------------------------------------ */
/* Productos                                                           */
/* ------------------------------------------------------------------ */

const productWithPath = {
  id: products.id,
  name: products.name,
  quantity: products.quantity,
  unit: products.unit,
  minQuantity: products.minQuantity,
  step: products.step,
  notes: products.notes,
  expiresAt: products.expiresAt,
  updatedAt: products.updatedAt,
  compartmentId: compartments.id,
  compartmentName: compartments.name,
  furnitureId: furnitures.id,
  furnitureName: furnitures.name,
  sectorId: sectors.id,
  sectorName: sectors.name,
};

export async function getLowStockProducts(familyId: string, limit = 30) {
  return db
    .select(productWithPath)
    .from(products)
    .innerJoin(compartments, eq(compartments.id, products.compartmentId))
    .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(
      and(
        eq(sectors.familyId, familyId),
        gt(products.minQuantity, 0),
        lte(products.quantity, products.minQuantity),
      ),
    )
    .orderBy(asc(products.quantity), asc(products.name))
    .limit(limit);
}

export type ProductWithPath = Awaited<
  ReturnType<typeof getLowStockProducts>
>[number];

export async function searchProducts(familyId: string, term: string) {
  const clean = term.trim();
  if (!clean) return [];

  return db
    .select(productWithPath)
    .from(products)
    .innerJoin(compartments, eq(compartments.id, products.compartmentId))
    .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(and(eq(sectors.familyId, familyId), ilike(products.name, `%${clean}%`)))
    .orderBy(asc(products.name))
    .limit(60);
}

/** Devuelve el producto sólo si pertenece a la familia indicada. */
export async function getProductForFamily(familyId: string, productId: string) {
  const [row] = await db
    .select({
      product: products,
      familyId: sectors.familyId,
      furnitureId: furnitures.id,
      furnitureName: furnitures.name,
      sectorId: sectors.id,
      sectorName: sectors.name,
      compartmentName: compartments.name,
    })
    .from(products)
    .innerJoin(compartments, eq(compartments.id, products.compartmentId))
    .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(eq(products.id, productId))
    .limit(1);

  if (!row || row.familyId !== familyId) return null;
  return row;
}

export async function getProductMovements(productId: string, limit = 25) {
  return db
    .select()
    .from(movements)
    .where(eq(movements.productId, productId))
    .orderBy(desc(movements.createdAt))
    .limit(limit);
}

export async function getRecentMovements(familyId: string, limit = 15) {
  return db
    .select({
      id: movements.id,
      delta: movements.delta,
      resulting: movements.resulting,
      kind: movements.kind,
      userName: movements.userName,
      createdAt: movements.createdAt,
      productId: products.id,
      productName: products.name,
      unit: products.unit,
      furnitureId: furnitures.id,
      furnitureName: furnitures.name,
    })
    .from(movements)
    .innerJoin(products, eq(products.id, movements.productId))
    .innerJoin(compartments, eq(compartments.id, products.compartmentId))
    .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(eq(sectors.familyId, familyId))
    .orderBy(desc(movements.createdAt))
    .limit(limit);
}

export async function getFamilyStats(familyId: string) {
  const [row] = await db
    .select({
      sectorCount: sql<number>`count(distinct ${sectors.id})::int`,
      furnitureCount: sql<number>`count(distinct ${furnitures.id})::int`,
      productCount: sql<number>`count(distinct ${products.id})::int`,
      lowCount: sql<number>`count(distinct ${products.id}) filter (
        where ${products.minQuantity} > 0
          and ${products.quantity} <= ${products.minQuantity}
      )::int`,
    })
    .from(sectors)
    .leftJoin(furnitures, eq(furnitures.sectorId, sectors.id))
    .leftJoin(compartments, eq(compartments.furnitureId, furnitures.id))
    .leftJoin(products, eq(products.compartmentId, compartments.id))
    .where(eq(sectors.familyId, familyId));

  return (
    row ?? { sectorCount: 0, furnitureCount: 0, productCount: 0, lowCount: 0 }
  );
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

/** Todos los compartimientos de la familia (para mover productos de lugar). */
export async function getAllCompartments(familyId: string) {
  return db
    .select({
      id: compartments.id,
      name: compartments.name,
      furnitureName: furnitures.name,
    })
    .from(compartments)
    .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(eq(sectors.familyId, familyId))
    .orderBy(asc(sectors.name), asc(furnitures.name), asc(compartments.name));
}
