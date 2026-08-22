-- Carga en lote: la vuelta del super se revisa en un borrador y se confirma
-- de una sola vez. Más el lugar por defecto de cada producto, que es lo que
-- evita tener que contestar "¿dónde va?" ochenta veces.

DO $$ BEGIN
	CREATE TYPE "public"."intake_status" AS ENUM('BORRADOR', 'CONFIRMADO', 'DESCARTADO');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."intake_source" AS ENUM('LISTA', 'MANUAL', 'TICKET', 'ESCANER', 'VOZ');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "default_compartment_id" uuid;--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_default_compartment_id_compartments_id_fk";--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_default_compartment_id_compartments_id_fk" FOREIGN KEY ("default_compartment_id") REFERENCES "public"."compartments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "intake_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"status" "intake_status" DEFAULT 'BORRADOR' NOT NULL,
	"source" "intake_source" DEFAULT 'MANUAL' NOT NULL,
	"created_by_id" uuid,
	"created_by_name" text DEFAULT 'Alguien' NOT NULL,
	"note" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "intake_batches" DROP CONSTRAINT IF EXISTS "intake_batches_family_id_families_id_fk";--> statement-breakpoint
ALTER TABLE "intake_batches" ADD CONSTRAINT "intake_batches_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_batches" DROP CONSTRAINT IF EXISTS "intake_batches_created_by_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "intake_batches" ADD CONSTRAINT "intake_batches_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_batches_family_idx" ON "intake_batches" USING btree ("family_id","status");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "intake_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"product_id" uuid,
	"raw_label" text DEFAULT '' NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"compartment_id" uuid,
	"expires_at" date,
	"note" text,
	"skipped" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "intake_lines" DROP CONSTRAINT IF EXISTS "intake_lines_batch_id_intake_batches_id_fk";--> statement-breakpoint
ALTER TABLE "intake_lines" ADD CONSTRAINT "intake_lines_batch_id_intake_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."intake_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_lines" DROP CONSTRAINT IF EXISTS "intake_lines_product_id_products_id_fk";--> statement-breakpoint
ALTER TABLE "intake_lines" ADD CONSTRAINT "intake_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_lines" DROP CONSTRAINT IF EXISTS "intake_lines_compartment_id_compartments_id_fk";--> statement-breakpoint
ALTER TABLE "intake_lines" ADD CONSTRAINT "intake_lines_compartment_id_compartments_id_fk" FOREIGN KEY ("compartment_id") REFERENCES "public"."compartments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_lines_batch_idx" ON "intake_lines" USING btree ("batch_id","sort_order");--> statement-breakpoint

-- Arranque: el lugar por defecto es donde ya está guardado cada producto.
UPDATE "products" p
SET "default_compartment_id" = s."compartment_id"
FROM (
	SELECT DISTINCT ON ("product_id") "product_id", "compartment_id"
	FROM "stock_entries"
	ORDER BY "product_id", "quantity" DESC
) s
WHERE p."id" = s."product_id" AND p."default_compartment_id" IS NULL;
