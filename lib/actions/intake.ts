"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ilike, inArray, sql } from "drizzle-orm";

import { requireFamilyUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  compartments,
  furnitures,
  intakeBatches,
  intakeLines,
  movements,
  products,
  sectors,
  stockEntries,
  unitEnum,
  type Unit,
} from "@/lib/db/schema";
import {
  getOpenIntakeBatch,
  getPlacesForProducts,
  getShoppingList,
} from "@/lib/queries";
import { unitInfo } from "@/lib/units";
import { round3 } from "@/lib/utils";
import { done, fail, type ActionState } from "@/lib/actions/types";

/**
 * Carga en lote. La idea de fondo: volver del super con ochenta cosas no puede
 * ser ochenta formularios. Se arma un borrador, se revisa todo junto en una
 * pantalla y recién al confirmar impacta en el stock, en una sola transacción.
 *
 * Los renglones pueden venir de cualquier lado —hoy de la lista de compras o a
 * mano, mañana de una foto del ticket, del escáner o del dictado—: todos
 * terminan en la misma tabla y en la misma pantalla de revisión.
 */

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function refresh() {
  revalidatePath("/", "layout");
}

/** El lote, si es de la familia de quien lo pide. */
async function findBatch(familyId: string, batchId: string) {
  const [batch] = await db
    .select()
    .from(intakeBatches)
    .where(
      and(eq(intakeBatches.id, batchId), eq(intakeBatches.familyId, familyId)),
    )
    .limit(1);
  return batch ?? null;
}

/** El renglón junto con su lote, ya validado contra la familia. */
async function findLine(familyId: string, lineId: string) {
  const [row] = await db
    .select({ line: intakeLines, batch: intakeBatches })
    .from(intakeLines)
    .innerJoin(intakeBatches, eq(intakeBatches.id, intakeLines.batchId))
    .where(and(eq(intakeLines.id, lineId), eq(intakeBatches.familyId, familyId)))
    .limit(1);
  return row ?? null;
}

/** Un lote confirmado o descartado ya no se toca. */
function editable(status: string) {
  return status === "BORRADOR";
}

async function ownsProduct(familyId: string, productId: string) {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.familyId, familyId)))
    .limit(1);
  return Boolean(row);
}

async function ownsCompartment(familyId: string, compartmentId: string) {
  const [row] = await db
    .select({ id: compartments.id })
    .from(compartments)
    .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
    .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
    .where(
      and(eq(compartments.id, compartmentId), eq(sectors.familyId, familyId)),
    )
    .limit(1);
  return Boolean(row);
}

/** Nombre del lugar tal como lo guarda el historial: "Mueble · Estante". */
async function locationNames(compartmentIds: string[]) {
  if (compartmentIds.length === 0) return new Map<string, string>();

  const rows = await db
    .select({
      id: compartments.id,
      name: compartments.name,
      furnitureName: furnitures.name,
    })
    .from(compartments)
    .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
    .where(inArray(compartments.id, compartmentIds));

  return new Map(
    rows.map((row) => [row.id, `${row.furnitureName} · ${row.name}`]),
  );
}

function readUnit(raw: string): Unit {
  return (unitEnum.enumValues as readonly string[]).includes(raw)
    ? (raw as Unit)
    : "UNIDAD";
}

/* ------------------------------------------------------------------ */
/* Abrir una carga                                                     */
/* ------------------------------------------------------------------ */

/**
 * Arranca la carga con todo lo que la casa venía necesitando: cantidad
 * sugerida para volver a estar por encima del mínimo y el lugar de siempre ya
 * elegido. En el mejor de los casos alcanza con mirar la tabla y confirmar.
 */
export async function startIntakeFromListAction(): Promise<
  ActionState & { batchId?: string }
> {
  const user = await requireFamilyUser();

  // Un borrador a la vez: si quedó uno abierto se sigue ése.
  const open = await getOpenIntakeBatch(user.familyId);
  if (open) {
    return {
      ok: true,
      batchId: open.id,
      message: "Seguimos con la carga que estaba a medias.",
    };
  }

  const missing = await getShoppingList(user.familyId, 200);
  const places = await getPlacesForProducts(
    user.familyId,
    missing.map((product) => product.id),
  );

  const [batch] = await db
    .insert(intakeBatches)
    .values({
      familyId: user.familyId,
      source: "LISTA",
      createdById: user.id,
      createdByName: user.name,
    })
    .returning();

  if (missing.length > 0) {
    await db.insert(intakeLines).values(
      missing.map((product, index) => ({
        batchId: batch.id,
        productId: product.id,
        rawLabel: product.name,
        // Lo que hace falta para volver a estar por encima del mínimo.
        quantity: round3(
          Math.max(product.minQuantity - product.total, product.step),
        ),
        compartmentId:
          product.defaultCompartmentId ?? places.get(product.id) ?? null,
        sortOrder: index,
      })),
    );
  }

  refresh();
  return {
    ok: true,
    batchId: batch.id,
    message:
      missing.length > 0
        ? `Carga abierta con ${missing.length} ${missing.length === 1 ? "producto" : "productos"} de la lista.`
        : "Carga vacía: agregá lo que compraste.",
  };
}

/** Carga desde cero, para cuando lo comprado no tiene que ver con la lista. */
export async function startEmptyIntakeAction(): Promise<
  ActionState & { batchId?: string }
> {
  const user = await requireFamilyUser();

  const open = await getOpenIntakeBatch(user.familyId);
  if (open) {
    return {
      ok: true,
      batchId: open.id,
      message: "Seguimos con la carga que estaba a medias.",
    };
  }

  const [batch] = await db
    .insert(intakeBatches)
    .values({
      familyId: user.familyId,
      source: "MANUAL",
      createdById: user.id,
      createdByName: user.name,
    })
    .returning();

  refresh();
  return { ok: true, batchId: batch.id, message: "Carga abierta." };
}

/* ------------------------------------------------------------------ */
/* Renglones                                                           */
/* ------------------------------------------------------------------ */

/** Lo que la pantalla de revisión necesita para dibujar un renglón nuevo. */
type LinePayload = {
  id: string;
  productId: string;
  rawLabel: string;
  quantity: number;
  compartmentId: string | null;
  productName: string;
  productUnit: Unit;
  productStep: number;
  total: number;
};

/** Siguiente lugar en la lista, para que lo agregado quede abajo de todo. */
async function nextSortOrder(batchId: string) {
  const [last] = await db
    .select({
      next: sql<number>`coalesce(max(${intakeLines.sortOrder}), -1)::int`,
    })
    .from(intakeLines)
    .where(eq(intakeLines.batchId, batchId));

  return (last?.next ?? -1) + 1;
}

/** Agrega al lote un producto que ya está en el catálogo. */
export async function addIntakeLineAction(
  batchId: string,
  productId: string,
): Promise<ActionState & { line?: LinePayload }> {
  const user = await requireFamilyUser();

  const batch = await findBatch(user.familyId, batchId);
  if (!batch) return fail("No encontramos esa carga.");
  if (!editable(batch.status)) return fail("Esa carga ya está cerrada.");

  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      unit: products.unit,
      step: products.step,
      defaultCompartmentId: products.defaultCompartmentId,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.familyId, user.familyId)))
    .limit(1);

  if (!product) return fail("No encontramos ese producto.");

  // Aparte y sin correlacionar: en una subconsulta contra una sola tabla
  // Drizzle no califica los nombres y "product_id" = "id" nunca da true.
  const [stock] = await db
    .select({
      total: sql<number>`coalesce(sum(${stockEntries.quantity}), 0)::float8`,
    })
    .from(stockEntries)
    .where(eq(stockEntries.productId, product.id));

  const [line] = await db
    .insert(intakeLines)
    .values({
      batchId: batch.id,
      productId: product.id,
      rawLabel: product.name,
      quantity: product.step,
      compartmentId: product.defaultCompartmentId,
      sortOrder: await nextSortOrder(batch.id),
    })
    .returning();

  return {
    ok: true,
    line: {
      id: line.id,
      productId: product.id,
      rawLabel: product.name,
      quantity: line.quantity,
      compartmentId: line.compartmentId,
      productName: product.name,
      productUnit: product.unit,
      productStep: product.step,
      total: stock?.total ?? 0,
    },
  };
}

/**
 * Guarda lo que se toca en la pantalla de revisión. Se llama seguido —cada
 * cantidad, cada lugar—, así que no revalida toda la app: la tabla ya muestra
 * el cambio y el stock recién se mueve al confirmar.
 */
export async function updateIntakeLineAction(
  lineId: string,
  patch: {
    quantity?: number;
    compartmentId?: string | null;
    productId?: string;
    skipped?: boolean;
    expiresAt?: string | null;
    note?: string | null;
  },
): Promise<ActionState> {
  const user = await requireFamilyUser();

  const found = await findLine(user.familyId, lineId);
  if (!found) return fail("No encontramos ese renglón.");
  if (!editable(found.batch.status)) return fail("Esa carga ya está cerrada.");

  const values: Partial<typeof intakeLines.$inferInsert> = {};

  if (patch.quantity !== undefined) {
    if (!Number.isFinite(patch.quantity) || patch.quantity < 0) {
      return fail("Poné una cantidad válida.");
    }
    values.quantity = round3(patch.quantity);
  }

  if (patch.compartmentId !== undefined) {
    if (
      patch.compartmentId &&
      !(await ownsCompartment(user.familyId, patch.compartmentId))
    ) {
      return fail("No encontramos ese compartimiento.");
    }
    values.compartmentId = patch.compartmentId;
  }

  if (patch.productId !== undefined) {
    if (!(await ownsProduct(user.familyId, patch.productId))) {
      return fail("No encontramos ese producto.");
    }
    values.productId = patch.productId;
  }

  if (patch.skipped !== undefined) values.skipped = patch.skipped;
  if (patch.expiresAt !== undefined) values.expiresAt = patch.expiresAt || null;
  if (patch.note !== undefined) values.note = patch.note?.trim() || null;

  if (Object.keys(values).length === 0) return done();

  await db.update(intakeLines).set(values).where(eq(intakeLines.id, lineId));
  await db
    .update(intakeBatches)
    .set({ updatedAt: new Date() })
    .where(eq(intakeBatches.id, found.batch.id));

  return done();
}

export async function removeIntakeLineAction(
  lineId: string,
): Promise<ActionState> {
  const user = await requireFamilyUser();

  const found = await findLine(user.familyId, lineId);
  if (!found) return fail("No encontramos ese renglón.");
  if (!editable(found.batch.status)) return fail("Esa carga ya está cerrada.");

  await db.delete(intakeLines).where(eq(intakeLines.id, lineId));
  return done();
}

/**
 * Compraste algo que no estaba en el catálogo. Lo damos de alta con lo mínimo
 * —nombre y unidad— y el resto de la ficha se completa después con calma.
 *
 * Con `lineId` resuelve un renglón que estaba sin identificar; sin él agrega
 * uno nuevo al lote. Las dos puntas terminan igual: renglón con producto.
 */
export async function createProductForIntakeAction(
  batchId: string,
  lineId: string | null,
  name: string,
  unit: string,
): Promise<ActionState & { line?: LinePayload }> {
  const user = await requireFamilyUser();

  const batch = await findBatch(user.familyId, batchId);
  if (!batch) return fail("No encontramos esa carga.");
  if (!editable(batch.status)) return fail("Esa carga ya está cerrada.");

  if (lineId) {
    const found = await findLine(user.familyId, lineId);
    if (!found || found.batch.id !== batch.id) {
      return fail("No encontramos ese renglón.");
    }
  }

  const clean = name.trim();
  if (!clean) return fail("Poné un nombre para el producto.");

  const [duplicated] = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(and(eq(products.familyId, user.familyId), ilike(products.name, clean)))
    .limit(1);

  if (duplicated) {
    return fail(
      `Ya tenés "${duplicated.name}" en el catálogo: elegilo del buscador.`,
    );
  }

  const parsed = readUnit(unit);
  const step = unitInfo(parsed).defaultStep;

  const [product] = await db
    .insert(products)
    .values({
      familyId: user.familyId,
      name: clean,
      unit: parsed,
      step,
      createdById: user.id,
    })
    .returning();

  const [line] = lineId
    ? await db
        .update(intakeLines)
        .set({ productId: product.id, rawLabel: clean, quantity: step })
        .where(eq(intakeLines.id, lineId))
        .returning()
    : await db
        .insert(intakeLines)
        .values({
          batchId: batch.id,
          productId: product.id,
          rawLabel: clean,
          quantity: step,
          sortOrder: await nextSortOrder(batch.id),
        })
        .returning();

  refresh();
  return {
    ok: true,
    line: {
      id: line.id,
      productId: product.id,
      rawLabel: clean,
      quantity: line.quantity,
      compartmentId: line.compartmentId,
      productName: clean,
      productUnit: parsed,
      productStep: step,
      total: 0,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Cierre del lote                                                     */
/* ------------------------------------------------------------------ */

/**
 * El único momento en que la carga toca el stock. Todo junto y en una
 * transacción: o entran los ochenta productos o no entra ninguno.
 */
export async function confirmIntakeBatchAction(
  batchId: string,
): Promise<ActionState> {
  const user = await requireFamilyUser();

  const batch = await findBatch(user.familyId, batchId);
  if (!batch) return fail("No encontramos esa carga.");
  if (!editable(batch.status)) return fail("Esa carga ya se había confirmado.");

  const lines = await db
    .select()
    .from(intakeLines)
    .where(and(eq(intakeLines.batchId, batch.id), eq(intakeLines.skipped, false)));

  if (lines.length === 0) {
    return fail("No hay nada para guardar: todos los renglones están saltados.");
  }

  const incomplete = lines.filter(
    (line) => !line.productId || !line.compartmentId || line.quantity <= 0,
  );

  if (incomplete.length > 0) {
    return fail(
      incomplete.length === 1
        ? "Queda 1 renglón sin producto, sin lugar o en cero. Completalo o salteálo."
        : `Quedan ${incomplete.length} renglones sin producto, sin lugar o en cero. Completalos o salteálos.`,
    );
  }

  // Los ids se validan al escribirlos, pero esta acción también es una URL que
  // se puede llamar desde afuera de la pantalla: se revisan de nuevo.
  const productIds = [...new Set(lines.map((line) => line.productId!))];
  const compartmentIds = [...new Set(lines.map((line) => line.compartmentId!))];

  const [ownedProducts, ownedCompartments] = await Promise.all([
    db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          inArray(products.id, productIds),
          eq(products.familyId, user.familyId),
        ),
      ),
    db
      .select({ id: compartments.id })
      .from(compartments)
      .innerJoin(furnitures, eq(furnitures.id, compartments.furnitureId))
      .innerJoin(sectors, eq(sectors.id, furnitures.sectorId))
      .where(
        and(
          inArray(compartments.id, compartmentIds),
          eq(sectors.familyId, user.familyId),
        ),
      ),
  ]);

  if (
    ownedProducts.length !== productIds.length ||
    ownedCompartments.length !== compartmentIds.length
  ) {
    return fail("Hay renglones que apuntan a algo que ya no existe.");
  }

  /**
   * El mismo producto puede aparecer dos veces (dos paquetes, dos renglones
   * del ticket). Como en el stock hay una sola fila por producto y lugar, se
   * suman antes de escribir.
   */
  type Grouped = {
    productId: string;
    compartmentId: string;
    quantity: number;
    expiresAt: string | null;
    note: string | null;
  };

  const grouped = new Map<string, Grouped>();
  for (const line of lines) {
    const key = `${line.productId}:${line.compartmentId}`;
    const current = grouped.get(key);
    if (current) {
      current.quantity = round3(current.quantity + line.quantity);
      current.expiresAt ??= line.expiresAt;
      current.note ??= line.note;
    } else {
      grouped.set(key, {
        productId: line.productId!,
        compartmentId: line.compartmentId!,
        quantity: line.quantity,
        expiresAt: line.expiresAt,
        note: line.note,
      });
    }
  }

  const rows = [...grouped.values()];

  // Qué existencias ya existían: define si el movimiento es alta o reposición.
  const existing = await db
    .select({
      productId: stockEntries.productId,
      compartmentId: stockEntries.compartmentId,
    })
    .from(stockEntries)
    .where(
      and(
        inArray(stockEntries.productId, productIds),
        inArray(stockEntries.compartmentId, compartmentIds),
      ),
    );

  const existed = new Set(
    existing.map((row) => `${row.productId}:${row.compartmentId}`),
  );

  const places = await locationNames(compartmentIds);

  await db.transaction(async (tx) => {
    // Un solo INSERT para todo: si el producto ya estaba en ese lugar, suma.
    const saved = await tx
      .insert(stockEntries)
      .values(
        rows.map((row) => ({
          productId: row.productId,
          compartmentId: row.compartmentId,
          quantity: row.quantity,
          expiresAt: row.expiresAt,
          note: row.note,
        })),
      )
      .onConflictDoUpdate({
        target: [stockEntries.productId, stockEntries.compartmentId],
        set: {
          quantity: sql`${stockEntries.quantity} + excluded.quantity`,
          expiresAt: sql`coalesce(excluded.expires_at, ${stockEntries.expiresAt})`,
          note: sql`coalesce(excluded.note, ${stockEntries.note})`,
          updatedAt: new Date(),
        },
      })
      .returning({
        productId: stockEntries.productId,
        compartmentId: stockEntries.compartmentId,
        quantity: stockEntries.quantity,
      });

    const resulting = new Map(
      saved.map((row) => [
        `${row.productId}:${row.compartmentId}`,
        row.quantity,
      ]),
    );

    await tx.insert(movements).values(
      rows.map((row) => {
        const key = `${row.productId}:${row.compartmentId}`;
        return {
          productId: row.productId,
          compartmentId: row.compartmentId,
          locationName: places.get(row.compartmentId) ?? "Sin lugar",
          userId: user.id,
          userName: user.name,
          kind: existed.has(key) ? ("REPOSICION" as const) : ("ALTA" as const),
          delta: row.quantity,
          resulting: resulting.get(key) ?? row.quantity,
          note: "Carga de compras",
        };
      }),
    );

    // La app aprende dónde va cada cosa: la próxima vez ya viene elegido.
    await tx.execute(sql`
      update ${products} set default_compartment_id = v.compartment_id
      from (values ${sql.join(
        rows.map(
          (row) => sql`(${row.productId}::uuid, ${row.compartmentId}::uuid)`,
        ),
        sql`, `,
      )}) as v(product_id, compartment_id)
      where ${products.id} = v.product_id
        and ${products.familyId} = ${user.familyId}
    `);

    await tx
      .update(intakeBatches)
      .set({
        status: "CONFIRMADO",
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(intakeBatches.id, batch.id));
  });

  refresh();
  return done(
    rows.length === 1
      ? "Guardado 1 producto."
      : `Guardados ${rows.length} productos de una.`,
  );
}

/** Tirar el borrador sin tocar el stock. */
export async function discardIntakeBatchAction(
  batchId: string,
): Promise<ActionState> {
  const user = await requireFamilyUser();

  const batch = await findBatch(user.familyId, batchId);
  if (!batch) return fail("No encontramos esa carga.");
  if (!editable(batch.status)) return fail("Esa carga ya está cerrada.");

  await db
    .update(intakeBatches)
    .set({ status: "DESCARTADO", updatedAt: new Date() })
    .where(eq(intakeBatches.id, batch.id));

  refresh();
  return done("Carga descartada. El stock quedó como estaba.");
}
