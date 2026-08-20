CREATE TYPE "public"."movement_kind" AS ENUM('ALTA', 'CONSUMO', 'REPOSICION', 'AJUSTE');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'USER');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('UNIDAD', 'KG', 'G', 'L', 'ML', 'PAQUETE');--> statement-breakpoint
CREATE TABLE "compartments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"furniture_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "furnitures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sector_id" uuid NOT NULL,
	"name" text NOT NULL,
	"qr_token" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "furnitures_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
CREATE TABLE "movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid,
	"user_name" text DEFAULT 'Alguien' NOT NULL,
	"kind" "movement_kind" DEFAULT 'AJUSTE' NOT NULL,
	"delta" numeric(12, 3) DEFAULT 0 NOT NULL,
	"resulting" numeric(12, 3) DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compartment_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" numeric(12, 3) DEFAULT 0 NOT NULL,
	"unit" "unit" DEFAULT 'UNIDAD' NOT NULL,
	"min_quantity" numeric(12, 3) DEFAULT 0 NOT NULL,
	"step" numeric(12, 3) DEFAULT 1 NOT NULL,
	"notes" text,
	"expires_at" date,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'box' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sectors_family_name_unique" UNIQUE("family_id","name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'USER' NOT NULL,
	"family_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "compartments" ADD CONSTRAINT "compartments_furniture_id_furnitures_id_fk" FOREIGN KEY ("furniture_id") REFERENCES "public"."furnitures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "furnitures" ADD CONSTRAINT "furnitures_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_compartment_id_compartments_id_fk" FOREIGN KEY ("compartment_id") REFERENCES "public"."compartments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compartments_furniture_idx" ON "compartments" USING btree ("furniture_id");--> statement-breakpoint
CREATE INDEX "furnitures_sector_idx" ON "furnitures" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX "movements_product_idx" ON "movements" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "products_compartment_idx" ON "products" USING btree ("compartment_id");--> statement-breakpoint
CREATE INDEX "sectors_family_idx" ON "sectors" USING btree ("family_id");