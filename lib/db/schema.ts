import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const roleEnum = pgEnum("role", ["ADMIN", "USER"]);

export const unitEnum = pgEnum("unit", [
  "UNIDAD",
  "KG",
  "G",
  "L",
  "ML",
  "PAQUETE",
]);

export const movementKindEnum = pgEnum("movement_kind", [
  "ALTA",
  "CONSUMO",
  "REPOSICION",
  "AJUSTE",
]);

/* ------------------------------------------------------------------ */
/* Tablas                                                              */
/* ------------------------------------------------------------------ */

export const families = pgTable("families", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("USER"),
  familyId: uuid("family_id").references(() => families.id, {
    onDelete: "set null",
  }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Sector: cocina, lavadero, despensa, baño... */
export const sectors = pgTable(
  "sectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("box"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("sectors_family_idx").on(t.familyId),
    unique("sectors_family_name_unique").on(t.familyId, t.name),
  ],
);

/** Mueble: heladera, alacena, placard... Cada uno tiene su propio QR. */
export const furnitures = pgTable(
  "furnitures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectorId: uuid("sector_id")
      .notNull()
      .references(() => sectors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Token corto e irrepetible que viaja dentro del código QR. */
    qrToken: text("qr_token").notNull().unique(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("furnitures_sector_idx").on(t.sectorId)],
);

/** Compartimiento: freezer, heladera, primer estante... */
export const compartments = pgTable(
  "compartments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    furnitureId: uuid("furniture_id")
      .notNull()
      .references(() => furnitures.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("compartments_furniture_idx").on(t.furnitureId)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    compartmentId: uuid("compartment_id")
      .notNull()
      .references(() => compartments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3, mode: "number" })
      .notNull()
      .default(0),
    unit: unitEnum("unit").notNull().default("UNIDAD"),
    /** Cantidad a partir de la cual la app avisa que hay que reponer. */
    minQuantity: numeric("min_quantity", {
      precision: 12,
      scale: 3,
      mode: "number",
    })
      .notNull()
      .default(0),
    /** Cuánto suma o resta cada toque de los botones + / -. */
    step: numeric("step", { precision: 12, scale: 3, mode: "number" })
      .notNull()
      .default(1),
    notes: text("notes"),
    expiresAt: date("expires_at"),
    createdById: uuid("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("products_compartment_idx").on(t.compartmentId)],
);

/** Historial: quién sumó o descontó, cuánto y cuándo. */
export const movements = pgTable(
  "movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Se guarda el nombre por si ese usuario se elimina más adelante. */
    userName: text("user_name").notNull().default("Alguien"),
    kind: movementKindEnum("kind").notNull().default("AJUSTE"),
    delta: numeric("delta", { precision: 12, scale: 3, mode: "number" })
      .notNull()
      .default(0),
    resulting: numeric("resulting", { precision: 12, scale: 3, mode: "number" })
      .notNull()
      .default(0),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("movements_product_idx").on(t.productId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Relaciones                                                          */
/* ------------------------------------------------------------------ */

export const familiesRelations = relations(families, ({ many }) => ({
  users: many(users),
  sectors: many(sectors),
}));

export const usersRelations = relations(users, ({ one }) => ({
  family: one(families, {
    fields: [users.familyId],
    references: [families.id],
  }),
}));

export const sectorsRelations = relations(sectors, ({ one, many }) => ({
  family: one(families, {
    fields: [sectors.familyId],
    references: [families.id],
  }),
  furnitures: many(furnitures),
}));

export const furnituresRelations = relations(furnitures, ({ one, many }) => ({
  sector: one(sectors, {
    fields: [furnitures.sectorId],
    references: [sectors.id],
  }),
  compartments: many(compartments),
}));

export const compartmentsRelations = relations(
  compartments,
  ({ one, many }) => ({
    furniture: one(furnitures, {
      fields: [compartments.furnitureId],
      references: [furnitures.id],
    }),
    products: many(products),
  }),
);

export const productsRelations = relations(products, ({ one, many }) => ({
  compartment: one(compartments, {
    fields: [products.compartmentId],
    references: [compartments.id],
  }),
  movements: many(movements),
}));

export const movementsRelations = relations(movements, ({ one }) => ({
  product: one(products, {
    fields: [movements.productId],
    references: [products.id],
  }),
  user: one(users, { fields: [movements.userId], references: [users.id] }),
}));

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export type Family = typeof families.$inferSelect;
export type User = typeof users.$inferSelect;
export type Sector = typeof sectors.$inferSelect;
export type Furniture = typeof furnitures.$inferSelect;
export type Compartment = typeof compartments.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Movement = typeof movements.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type Unit = (typeof unitEnum.enumValues)[number];
export type MovementKind = (typeof movementKindEnum.enumValues)[number];
