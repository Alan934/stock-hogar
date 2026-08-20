"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { requireFamilyUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { shoppingItems } from "@/lib/db/schema";
import { done, fail, type ActionState } from "@/lib/actions/types";

/**
 * La lista de compras la maneja cualquier integrante: son notas para ir al
 * super, no inventario. Por eso tachar y borrar no piden ser administrador.
 */

function refresh() {
  revalidatePath("/compras");
}

/** Devuelve el ítem sólo si es de la familia de quien lo pide. */
async function findItem(familyId: string, id: string) {
  const [item] = await db
    .select()
    .from(shoppingItems)
    .where(and(eq(shoppingItems.id, id), eq(shoppingItems.familyId, familyId)))
    .limit(1);
  return item ?? null;
}

export async function addShoppingItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireFamilyUser();
  const label = String(formData.get("label") ?? "").trim();

  if (!label) return fail("Escribí qué hay que comprar.");
  if (label.length > 120) return fail("Es un poco largo: acortalo un toque.");

  await db.insert(shoppingItems).values({
    familyId: user.familyId,
    label,
    createdById: user.id,
    createdByName: user.name,
  });

  refresh();
  return done(`"${label}" anotado.`);
}

export async function toggleShoppingItemAction(
  id: string,
): Promise<ActionState> {
  const user = await requireFamilyUser();

  const item = await findItem(user.familyId, id);
  if (!item) return fail("No encontramos ese ítem.");

  await db
    .update(shoppingItems)
    .set({ done: !item.done, updatedAt: new Date() })
    .where(eq(shoppingItems.id, id));

  refresh();
  return done();
}

export async function deleteShoppingItemAction(
  id: string,
): Promise<ActionState> {
  const user = await requireFamilyUser();

  const item = await findItem(user.familyId, id);
  if (!item) return fail("No encontramos ese ítem.");

  await db.delete(shoppingItems).where(eq(shoppingItems.id, id));

  refresh();
  return done(`"${item.label}" borrado de la lista.`);
}

/** Limpia de una todo lo que ya se compró. */
export async function clearDoneShoppingItemsAction(): Promise<ActionState> {
  const user = await requireFamilyUser();

  const removed = await db
    .delete(shoppingItems)
    .where(
      and(
        eq(shoppingItems.familyId, user.familyId),
        eq(shoppingItems.done, true),
      ),
    )
    .returning({ id: shoppingItems.id });

  refresh();
  return done(
    removed.length === 0
      ? "No había nada tachado."
      : `${removed.length} ${removed.length === 1 ? "ítem borrado" : "ítems borrados"}.`,
  );
}
