/**
 * Aplica drizzle/0001_catalogo.sql: parte el producto en catálogo + existencias.
 *
 *   node --env-file=.env scripts/migrar-catalogo.mjs
 *
 * No borra nada: antes de tocar la base escribe un respaldo en JSON y la tabla
 * vieja queda guardada como "products_legacy".
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

async function main() {
  const yaMigrado = await sql`
    select to_regclass('public.stock_entries') is not null as listo
  `;
  if (yaMigrado[0].listo) {
    console.log("La base ya tiene stock_entries: no hay nada que migrar.");
    return;
  }

  /* --- Respaldo fuera de la base ------------------------------------- */

  const products = await sql`
    select p.*, s.family_id, c.name as compartment_name,
           fu.name as furniture_name, s.name as sector_name
    from products p
    join compartments c on c.id = p.compartment_id
    join furnitures fu on fu.id = c.furniture_id
    join sectors s on s.id = fu.sector_id
    order by p.created_at
  `;
  const movements = await sql`select * from movements order by created_at`;

  const dir = path.join(process.cwd(), "respaldos");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `productos-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  fs.writeFileSync(
    file,
    JSON.stringify({ products: [...products], movements: [...movements] }, null, 2),
  );

  console.log(`Respaldo: ${products.length} productos y ${movements.length} movimientos`);
  console.log(`          ${file}\n`);

  for (const product of products) {
    console.log(
      `  ${product.name}: ${product.quantity} ${product.unit} en ${product.sector_name} › ${product.furniture_name} › ${product.compartment_name}`,
    );
  }

  /* --- Migración ------------------------------------------------------ */

  const statements = fs
    .readFileSync(path.join(process.cwd(), "drizzle", "0001_catalogo.sql"), "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  // ALTER TYPE ... ADD VALUE va suelto: el valor nuevo no se puede usar dentro
  // de la misma transacción que lo crea.
  const [addEnumValue, ...resto] = statements;
  await sql.unsafe(addEnumValue);

  await sql.begin(async (tx) => {
    for (const statement of resto) {
      await tx.unsafe(statement);
    }
  });

  /* --- Verificación --------------------------------------------------- */

  const resumen = await sql`
    select
      (select count(*) from products)::int        as catalogo,
      (select count(*) from stock_entries)::int   as existencias,
      (select count(*) from movements)::int       as movimientos,
      (select count(*) from products_legacy)::int as filas_viejas
  `;

  const detalle = await sql`
    select p.name, p.unit, sum(se.quantity) as total, count(*)::int as lugares
    from products p
    join stock_entries se on se.product_id = p.id
    group by p.id, p.name, p.unit
    order by p.name
  `;

  console.log("\nMigración lista:", resumen[0]);
  for (const row of detalle) {
    console.log(
      `  ${row.name}: ${row.total} ${row.unit} repartido en ${row.lugares} lugar(es)`,
    );
  }
  console.log(
    '\nLa tabla "products_legacy" queda como respaldo dentro de la base.\nCuando estés tranquilo, se puede eliminar.',
  );
}

main()
  .then(() => sql.end())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("\nFalló la migración (no se aplicó nada):", error.message ?? error);
    await sql.end();
    process.exit(1);
  });
