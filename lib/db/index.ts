import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Falta DATABASE_URL. Copiá .env.example a .env y completá la conexión de Neon.",
  );
}

// En desarrollo Next.js recarga los módulos en caliente: sin este cache
// abriríamos una conexión nueva a Neon en cada guardado.
const globalForDb = globalThis as unknown as {
  __stockHogarClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__stockHogarClient ??
  postgres(connectionString, {
    ssl: "require",
    max: 5,
    idle_timeout: 20,
    connect_timeout: 30,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__stockHogarClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
