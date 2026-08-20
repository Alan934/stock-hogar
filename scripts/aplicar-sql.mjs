/**
 * Aplica un archivo .sql de drizzle/ en una transacción.
 *
 *   node --env-file=.env scripts/aplicar-sql.mjs drizzle/0002_lista_compras.sql
 *
 * Existe porque drizzle-kit push necesita una terminal interactiva para
 * confirmar cambios, y acá conviene tener el SQL explícito y revisable.
 */
import fs from "node:fs";
import postgres from "postgres";

const file = process.argv[2];

if (!file) {
  console.error("Indicá el archivo: node --env-file=.env scripts/aplicar-sql.mjs drizzle/0002_lista_compras.sql");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

const statements = fs
  .readFileSync(file, "utf8")
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter(Boolean);

try {
  await sql.begin(async (tx) => {
    for (const statement of statements) {
      await tx.unsafe(statement);
    }
  });
  console.log(`${file}: ${statements.length} sentencias aplicadas.`);
} catch (error) {
  console.error("No se aplicó nada:", error.message ?? error);
  process.exitCode = 1;
}

await sql.end();
