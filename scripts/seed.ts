/**
 * Carga de ejemplo. Arma la cocina del pedido original (heladera dividida en
 * freezer y heladera), un baño y un lavadero, dentro de la familia de una
 * cuenta que ya exista.
 *
 * Antes de correrlo creá tu cuenta en /instalacion. Después:
 *   npm run db:seed -- --admin tucorreo@ejemplo.com
 *
 * No crea usuarios ni contraseñas por su cuenta, justamente para no dejar
 * cuentas con claves por defecto dando vueltas.
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
  users,
  type Unit,
} from "@/lib/db/schema";
import { createToken } from "@/lib/utils";

function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const ADMIN_EMAIL = arg("admin", "").toLowerCase();

type ProductSeed = {
  name: string;
  quantity: number;
  unit: Unit;
  minQuantity?: number;
  step?: number;
  notes?: string;
};

const LAYOUT: {
  sector: string;
  icon: string;
  furnitures: {
    name: string;
    compartments: { name: string; products: ProductSeed[] }[];
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
            products: [
              { name: "Carne molida", quantity: 2, unit: "KG", minQuantity: 0.5, step: 0.25 },
              { name: "Helado", quantity: 1, unit: "KG", minQuantity: 0, step: 0.25 },
              { name: "Milanesas", quantity: 12, unit: "UNIDAD", minQuantity: 4 },
            ],
          },
          {
            name: "Heladera",
            products: [
              { name: "Mayonesa", quantity: 1, unit: "UNIDAD", minQuantity: 1 },
              { name: "Manteca", quantity: 3, unit: "UNIDAD", minQuantity: 1, notes: "Potes de 500 g" },
              { name: "Queso cremoso", quantity: 750, unit: "G", minQuantity: 250, step: 50 },
              { name: "Leche", quantity: 2, unit: "L", minQuantity: 1, step: 1 },
            ],
          },
        ],
      },
      {
        name: "Alacena",
        compartments: [
          {
            name: "Estante de arriba",
            products: [
              { name: "Fideos", quantity: 4, unit: "PAQUETE", minQuantity: 2 },
              { name: "Arroz", quantity: 2, unit: "KG", minQuantity: 1, step: 0.5 },
            ],
          },
          {
            name: "Estante de abajo",
            products: [
              { name: "Yerba", quantity: 1, unit: "KG", minQuantity: 1, step: 0.5 },
              { name: "Azúcar", quantity: 1, unit: "KG", minQuantity: 1, step: 0.5 },
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
            products: [
              { name: "Ibuprofeno", quantity: 20, unit: "UNIDAD", minQuantity: 6, notes: "Comprimidos de 400 mg" },
              { name: "Alcohol en gel", quantity: 1, unit: "UNIDAD", minQuantity: 1 },
            ],
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
            products: [
              { name: "Jabón en polvo", quantity: 3, unit: "KG", minQuantity: 1, step: 0.5 },
              { name: "Lavandina", quantity: 2, unit: "L", minQuantity: 1, step: 1 },
              { name: "Papel higiénico", quantity: 8, unit: "UNIDAD", minQuantity: 4 },
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
Creá la tuya entrando a /instalacion y volvé a correr esto.`,
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

  for (const [sectorIndex, entry] of LAYOUT.entries()) {
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

      for (const [compartmentIndex, compartmentSeed] of furnitureSeed.compartments.entries()) {
        const [compartment] = await db
          .insert(compartments)
          .values({
            furnitureId: furniture.id,
            name: compartmentSeed.name,
            sortOrder: compartmentIndex,
          })
          .returning();

        for (const productSeed of compartmentSeed.products) {
          const [product] = await db
            .insert(products)
            .values({
              compartmentId: compartment.id,
              name: productSeed.name,
              quantity: productSeed.quantity,
              unit: productSeed.unit,
              minQuantity: productSeed.minQuantity ?? 0,
              step: productSeed.step ?? 1,
              notes: productSeed.notes ?? null,
              createdById: admin.id,
            })
            .returning();

          await db.insert(movements).values({
            productId: product.id,
            userId: admin.id,
            userName: admin.name,
            kind: "ALTA",
            delta: productSeed.quantity,
            resulting: productSeed.quantity,
            note: "Carga inicial",
          });
        }
      }

      console.log(`  ${entry.sector} › ${furnitureSeed.name} listo`);
    }
  }

  console.log(`
Datos de ejemplo cargados en la casa de ${ADMIN_EMAIL}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Falló el seed:", error);
    process.exit(1);
  });
