import { defineConfig } from "drizzle-kit";

// drizzle-kit corre fuera de Next.js, así que cargamos el .env a mano.
try {
  process.loadEnvFile(".env");
} catch {
  // Si no existe el archivo asumimos que las variables ya están en el entorno.
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: false,
});
