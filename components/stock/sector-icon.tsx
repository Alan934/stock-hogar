import {
  Apple,
  Archive,
  Baby,
  Bath,
  Bed,
  BookOpen,
  Box,
  Boxes,
  Brush,
  Car,
  CookingPot,
  Dog,
  Droplets,
  Gamepad2,
  Hammer,
  Laptop,
  Milk,
  Package,
  Pill,
  Refrigerator,
  Shirt,
  Snowflake,
  Sofa,
  Soup,
  Sparkles,
  TreePine,
  Utensils,
  Warehouse,
  Wine,
  Wrench,
} from "lucide-react";

/** Íconos disponibles para sectores y muebles. */
export const SECTOR_ICONS = {
  box: { icon: Box, label: "Caja" },
  boxes: { icon: Boxes, label: "Cajas" },
  cocina: { icon: CookingPot, label: "Cocina" },
  utensilios: { icon: Utensils, label: "Utensilios" },
  heladera: { icon: Refrigerator, label: "Heladera" },
  freezer: { icon: Snowflake, label: "Freezer" },
  despensa: { icon: Archive, label: "Despensa" },
  lacteos: { icon: Milk, label: "Lácteos" },
  frutas: { icon: Apple, label: "Frutas" },
  sopa: { icon: Soup, label: "Comida" },
  bebidas: { icon: Wine, label: "Bebidas" },
  bano: { icon: Bath, label: "Baño" },
  limpieza: { icon: Droplets, label: "Limpieza" },
  cepillo: { icon: Brush, label: "Higiene" },
  botiquin: { icon: Pill, label: "Botiquín" },
  ropa: { icon: Shirt, label: "Ropa" },
  dormitorio: { icon: Bed, label: "Dormitorio" },
  living: { icon: Sofa, label: "Living" },
  bebe: { icon: Baby, label: "Bebé" },
  mascotas: { icon: Dog, label: "Mascotas" },
  herramientas: { icon: Hammer, label: "Herramientas" },
  taller: { icon: Wrench, label: "Taller" },
  garage: { icon: Car, label: "Garage" },
  galpon: { icon: Warehouse, label: "Galpón" },
  jardin: { icon: TreePine, label: "Jardín" },
  escritorio: { icon: Laptop, label: "Escritorio" },
  libros: { icon: BookOpen, label: "Libros" },
  juegos: { icon: Gamepad2, label: "Juegos" },
  paquete: { icon: Package, label: "Paquete" },
  brillo: { icon: Sparkles, label: "Varios" },
} as const;

export type SectorIconName = keyof typeof SECTOR_ICONS;

export function SectorIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const entry = SECTOR_ICONS[name as SectorIconName] ?? SECTOR_ICONS.box;
  const Icon = entry.icon;
  return <Icon className={className} />;
}
