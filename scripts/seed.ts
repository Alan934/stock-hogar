/**
 * Carga de ejemplo. Arma la cocina del pedido original (heladera dividida en
 * freezer y heladera), un baño y un lavadero, dentro de la familia de una
 * cuenta que ya exista.
 *
 * Antes de correrlo creá tu cuenta. Después:
 *   npm run db:seed -- --admin tucorreo@ejemplo.com
 *
 * Incluye a propósito dos casos del mundo real: el queso repartido entre el
 * freezer y la heladera, y el papel higiénico en el baño con reserva en la
 * pieza. Sirven para ver cómo un mismo producto vive en varios lugares.
 */
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  compartments,
  families,
  furnitures,
  movements,
  products,
  sectors,
  stockEntries,
  users,
  type Unit,
} from "@/lib/db/schema";
import { createToken } from "@/lib/utils";

function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const ADMIN_EMAIL = arg("admin", "").toLowerCase();

/** Catálogo: el "qué es", una sola vez cada uno. */
const CATALOGO: {
  name: string;
  unit: Unit;
  step: number;
  minQuantity: number;
  notes?: string;
}[] = [
  { name: "Queso cremoso", unit: "G", step: 50, minQuantity: 250, notes: "Marca Sobrero" },
  { name: "Carne molida", unit: "KG", step: 0.25, minQuantity: 0.5 },
  { name: "Helado", unit: "KG", step: 0.25, minQuantity: 0 },
  { name: "Milanesas", unit: "UNIDAD", step: 1, minQuantity: 4 },
  { name: "Mayonesa", unit: "UNIDAD", step: 1, minQuantity: 1 },
  { name: "Manteca", unit: "UNIDAD", step: 1, minQuantity: 1, notes: "Potes de 500 g" },
  { name: "Leche", unit: "L", step: 1, minQuantity: 2 },
  { name: "Fideos", unit: "PAQUETE", step: 1, minQuantity: 2 },
  { name: "Arroz", unit: "KG", step: 0.5, minQuantity: 1 },
  { name: "Yerba", unit: "KG", step: 0.5, minQuantity: 1 },
  { name: "Azúcar", unit: "KG", step: 0.5, minQuantity: 1 },
  { name: "Ibuprofeno", unit: "UNIDAD", step: 1, minQuantity: 6, notes: "Comprimidos de 400 mg" },
  { name: "Alcohol en gel", unit: "UNIDAD", step: 1, minQuantity: 1 },
  { name: "Jabón en polvo", unit: "KG", step: 0.5, minQuantity: 1 },
  { name: "Lavandina", unit: "L", step: 1, minQuantity: 1 },
  { name: "Papel higiénico", unit: "UNIDAD", step: 1, minQuantity: 8 },
];

/** Estructura de la casa y qué hay guardado en cada compartimiento. */
const CASA: {
  sector: string;
  icon: string;
  furnitures: {
    name: string;
    compartments: {
      name: string;
      items: { product: string; quantity: number; localMin?: number }[];
    }[];
  }[];
}[] = [
  {
    sector: "Cocina",
    icon: "cocina",
    furnitures: [
      {
        name: "Heladera",
        compartments: [
          {
            name: "Freezer",
            items: [
              { product: "Carne molida", quantity: 2 },
              { product: "Helado", quantity: 1 },
              { product: "Milanesas", quantity: 12 },
              // El mismo queso, guardado también acá.
              { product: "Queso cremoso", quantity: 1000 },
            ],
          },
          {
            name: "Heladera",
            items: [
              { product: "Mayonesa", quantity: 1 },
              { product: "Manteca", quantity: 3 },
              { product: "Queso cremoso", quantity: 750 },
              { product: "Leche", quantity: 2 },
            ],
          },
        ],
      },
      {
        name: "Alacena",
        compartments: [
          {
            name: "Estante de arriba",
            items: [
              { product: "Fideos", quantity: 4 },
              { product: "Arroz", quantity: 2 },
            ],
          },
          {
            name: "Estante de abajo",
            items: [
              { product: "Yerba", quantity: 1 },
              { product: "Azúcar", quantity: 1 },
            ],
          },
        ],
      },
    ],
  },
  {
    sector: "Baño",
    icon: "bano",
    furnitures: [
      {
        name: "Botiquín",
        compartments: [
          {
            name: "General",
            items: [
              { product: "Ibuprofeno", quantity: 20 },
              { product: "Alcohol en gel", quantity: 1 },
              // Poco acá y con aviso propio: hay que traer de la reserva.
              { product: "Papel higiénico", quantity: 2, localMin: 3 },
            ],
          },
        ],
      },
    ],
  },
  {
    sector: "Pieza",
    icon: "dormitorio",
    furnitures: [
      {
        name: "Estantería",
        compartments: [
          {
            name: "Reserva",
            items: [{ product: "Papel higiénico", quantity: 12 }],
          },
        ],
      },
    ],
  },
  {
    sector: "Lavadero",
    icon: "limpieza",
    furnitures: [
      {
        name: "Estantería",
        compartments: [
          {
            name: "General",
            items: [
              { product: "Jabón en polvo", quantity: 3 },
              { product: "Lavandina", quantity: 2 },
            ],
          },
        ],
      },
    ],
  },
];

async function main() {
  if (!ADMIN_EMAIL) {
    console.error(
      `Indicá de quién es la casa:
  npm run db:seed -- --admin tucorreo@ejemplo.com`,
    );
    process.exit(1);
  }

  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (!admin) {
    console.error(
      `No existe ninguna cuenta con ${ADMIN_EMAIL}.
Creá la tuya con "npm run db:admin" y volvé a correr esto.`,
    );
    process.exit(1);
  }

  let familyId = admin.familyId;

  if (!familyId) {
    const [family] = await db
      .insert(families)
      .values({ name: "Mi casa" })
      .returning();
    familyId = family.id;
    await db.update(users).set({ familyId }).where(eq(users.id, admin.id));
    console.log(`Familia creada: ${family.name}`);
  }

  const existing = await db
    .select({ id: sectors.id })
    .from(sectors)
    .where(eq(sectors.familyId, familyId))
    .limit(1);

  if (existing.length) {
    console.log("La familia ya tiene sectores cargados: no se toca nada más.");
    return;
  }

  /* --- Catálogo -------------------------------------------------------- */

  const catalogIds = new Map<string, string>();

  for (const entry of CATALOGO) {
    const [product] = await db
      .insert(products)
      .values({
        familyId,
        name: entry.name,
        unit: entry.unit,
        step: entry.step,
        minQuantity: entry.minQuantity,
        notes: entry.notes ?? null,
        createdById: admin.id,
      })
      .returning();

    catalogIds.set(entry.name, product.id);
  }

  console.log(`Catálogo: ${CATALOGO.length} productos`);

  /* --- Casa y existencias ---------------------------------------------- */

  for (const [sectorIndex, entry] of CASA.entries()) {
    const [sector] = await db
      .insert(sectors)
      .values({
        familyId,
        name: entry.sector,
        icon: entry.icon,
        sortOrder: sectorIndex,
      })
      .returning();

    for (const [furnitureIndex, furnitureSeed] of entry.furnitures.entries()) {
      const [furniture] = await db
        .insert(furnitures)
        .values({
          sectorId: sector.id,
          name: furnitureSeed.name,
          qrToken: createToken(),
          sortOrder: furnitureIndex,
        })
        .returning();

      for (const [
        compartmentIndex,
        compartmentSeed,
      ] of furnitureSeed.compartments.entries()) {
        const [compartment] = await db
          .insert(compartments)
          .values({
            furnitureId: furniture.id,
            name: compartmentSeed.name,
            sortOrder: compartmentIndex,
          })
          .returning();

        for (const item of compartmentSeed.items) {
          const productId = catalogIds.get(item.product);
          if (!productId) throw new Error(`Falta en el catálogo: ${item.product}`);

          await db.insert(stockEntries).values({
            productId,
            compartmentId: compartment.id,
            quantity: item.quantity,
            minQuantity: item.localMin ?? null,
          });

          await db.insert(movements).values({
            productId,
            compartmentId: compartment.id,
            locationName: `${furnitureSeed.name} · ${compartmentSeed.name}`,
            userId: admin.id,
            userName: admin.name,
            kind: "ALTA",
            delta: item.quantity,
            resulting: item.quantity,
            note: "Carga inicial",
          });
        }
      }

      console.log(`  ${entry.sector} › ${furnitureSeed.name} listo`);
    }
  }

  console.log(`\nDatos de ejemplo cargados en la casa de ${ADMIN_EMAIL}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Falló el seed:", error);
    process.exit(1);
  });
