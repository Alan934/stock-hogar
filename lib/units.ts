import type { Unit } from "@/lib/db/schema";

export type UnitInfo = {
  value: Unit;
  /** Cómo se muestra en los selectores. */
  label: string;
  /** Abreviatura que acompaña al número. */
  short: string;
  /** Salto por defecto de los botones + / - al crear un producto. */
  defaultStep: number;
  /** Atajos que ofrece el panel de ajuste rápido. */
  quickSteps: number[];
};

export const UNITS: UnitInfo[] = [
  {
    value: "UNIDAD",
    label: "Unidades",
    short: "u",
    defaultStep: 1,
    quickSteps: [1, 2, 5, 10],
  },
  {
    value: "PAQUETE",
    label: "Paquetes",
    short: "paq",
    defaultStep: 1,
    quickSteps: [1, 2, 3, 6],
  },
  {
    value: "KG",
    label: "Kilogramos",
    short: "kg",
    defaultStep: 0.25,
    quickSteps: [0.25, 0.5, 1, 2],
  },
  {
    value: "G",
    label: "Gramos",
    short: "g",
    defaultStep: 100,
    quickSteps: [50, 100, 250, 500],
  },
  {
    value: "L",
    label: "Litros",
    short: "L",
    defaultStep: 0.5,
    quickSteps: [0.25, 0.5, 1, 2],
  },
  {
    value: "ML",
    label: "Mililitros",
    short: "ml",
    defaultStep: 50,
    quickSteps: [50, 100, 250, 500],
  },
];

const byValue = new Map(UNITS.map((unit) => [unit.value, unit]));

export function unitInfo(unit: Unit): UnitInfo {
  return byValue.get(unit) ?? UNITS[0];
}

export function unitShort(unit: Unit) {
  return unitInfo(unit).short;
}
