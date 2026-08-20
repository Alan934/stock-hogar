-- Separa el producto en dos ideas: el catálogo (qué es, una vez por familia) y
-- las existencias (cuánto hay y dónde). No borra datos: la tabla vieja queda
-- como "products_legacy" hasta que se decida eliminarla a mano.

ALTER TYPE "movement_kind" ADD VALUE IF NOT EXISTS 'TRASLADO';--> statement-breakpoint

--> Paso 1: correr la tabla vieja a un costado, liberando los nombres.
ALTER TABLE "products" RENAME TO "products_legacy";--> statement-breakpoint
ALTER TABLE "products_legacy" RENAME CONSTRAINT "products_pkey" TO "products_legacy_pkey";--> statement-breakpoint
ALTER TABLE "products_legacy" RENAME CONSTRAINT "products_created_by_id_users_id_fk" TO "products_legacy_created_by_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "products_legacy" RENAME CONSTRAINT "products_compartment_id_compartments_id_fk" TO "products_legacy_compartment_id_compartments_id_fk";--> statement-breakpoint
ALTER INDEX "products_compartment_idx" RENAME TO "products_legacy_compartment_idx";--> statement-breakpoint

--> Paso 2: el catálogo.
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" "unit" DEFAULT 'UNIDAD' NOT NULL,
	"step" numeric(12, 3) DEFAULT '1' NOT NULL,
	"min_quantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_family_name_unique" UNIQUE("family_id","name")
);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_family_idx" ON "products" USING btree ("family_id");--> statement-breakpoint

--> Paso 3: las existencias.
CREATE TABLE "stock_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"compartment_id" uuid NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"min_quantity" numeric(12, 3),
	"expires_at" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_product_compartment_unique" UNIQUE("product_id","compartment_id")
);--> statement-breakpoint
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_compartment_id_compartments_id_fk" FOREIGN KEY ("compartment_id") REFERENCES "public"."compartments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_product_idx" ON "stock_entries" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_compartment_idx" ON "stock_entries" USING btree ("compartment_id");--> statement-breakpoint

--> Paso 4: los movimientos pasan a registrar también el lugar.
ALTER TABLE "movements" DROP CONSTRAINT "movements_product_id_products_id_fk";--> statement-breakpoint
ALTER TABLE "movements" ADD COLUMN "compartment_id" uuid;--> statement-breakpoint
ALTER TABLE "movements" ADD COLUMN "location_name" text DEFAULT 'Sin lugar' NOT NULL;--> statement-breakpoint

--> Paso 5: llenar el catálogo agrupando los duplicados por nombre.
INSERT INTO "products" ("family_id", "name", "unit", "step", "min_quantity", "notes", "created_by_id", "created_at")
SELECT
	agrupado."family_id",
	agrupado."name",
	agrupado."unit",
	agrupado."step",
	agrupado."min_quantity",
	agrupado."notes",
	agrupado."created_by_id",
	agrupado."created_at"
FROM (
	SELECT DISTINCT ON (s."family_id", lower(trim(p."name")))
		s."family_id"                                                    AS "family_id",
		trim(p."name")                                                   AS "name",
		p."unit"                                                         AS "unit",
		max(p."step") OVER (PARTITION BY s."family_id", lower(trim(p."name")))        AS "step",
		-- El mínimo del catálogo aplica al total de la casa: nos quedamos con el
		-- más exigente de los que había por lugar.
		max(p."min_quantity") OVER (PARTITION BY s."family_id", lower(trim(p."name"))) AS "min_quantity",
		first_value(p."notes") OVER (
			PARTITION BY s."family_id", lower(trim(p."name"))
			ORDER BY (p."notes" IS NULL), p."created_at"
		)                                                                AS "notes",
		first_value(p."created_by_id") OVER (
			PARTITION BY s."family_id", lower(trim(p."name"))
			ORDER BY (p."created_by_id" IS NULL), p."created_at"
		)                                                                AS "created_by_id",
		min(p."created_at") OVER (PARTITION BY s."family_id", lower(trim(p."name")))  AS "created_at"
	FROM "products_legacy" p
	JOIN "compartments" c ON c."id" = p."compartment_id"
	JOIN "furnitures" fu ON fu."id" = c."furniture_id"
	JOIN "sectors" s ON s."id" = fu."sector_id"
	ORDER BY s."family_id", lower(trim(p."name")), p."created_at"
) agrupado;--> statement-breakpoint

--> Paso 6: cada fila vieja se vuelve una existencia. Si el mismo producto
--> estaba dos veces en el mismo compartimiento, se suman las cantidades.
INSERT INTO "stock_entries" ("product_id", "compartment_id", "quantity", "expires_at", "note", "created_at")
SELECT
	np."id",
	p."compartment_id",
	sum(p."quantity"),
	min(p."expires_at"),
	NULL,
	min(p."created_at")
FROM "products_legacy" p
JOIN "compartments" c ON c."id" = p."compartment_id"
JOIN "furnitures" fu ON fu."id" = c."furniture_id"
JOIN "sectors" s ON s."id" = fu."sector_id"
JOIN "products" np ON np."family_id" = s."family_id" AND lower(np."name") = lower(trim(p."name"))
GROUP BY np."id", p."compartment_id";--> statement-breakpoint

--> Paso 7: reapuntar el historial al producto del catálogo y anotarle el lugar.
UPDATE "movements" m
SET "product_id" = np."id",
    "compartment_id" = p."compartment_id",
    "location_name" = fu."name" || ' · ' || c."name"
FROM "products_legacy" p
JOIN "compartments" c ON c."id" = p."compartment_id"
JOIN "furnitures" fu ON fu."id" = c."furniture_id"
JOIN "sectors" s ON s."id" = fu."sector_id"
JOIN "products" np ON np."family_id" = s."family_id" AND lower(np."name") = lower(trim(p."name"))
WHERE m."product_id" = p."id";--> statement-breakpoint

--> Paso 8: si quedó algún movimiento sin producto (no debería), se descarta
--> para poder volver a crear la clave foránea.
DELETE FROM "movements" m
WHERE NOT EXISTS (SELECT 1 FROM "products" np WHERE np."id" = m."product_id");--> statement-breakpoint

ALTER TABLE "movements" ADD CONSTRAINT "movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_compartment_id_compartments_id_fk" FOREIGN KEY ("compartment_id") REFERENCES "public"."compartments"("id") ON DELETE set null ON UPDATE no action;
