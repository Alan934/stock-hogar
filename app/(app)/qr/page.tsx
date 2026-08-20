import type { Metadata } from "next";
import { QrCode } from "lucide-react";

import { EmptyState } from "@/components/ui/card";
import { QrSheet } from "./qr-sheet";
import { requireFamilyUser } from "@/lib/auth";
import { getAllFurnitures } from "@/lib/queries";

export const metadata: Metadata = { title: "Códigos QR" };

export default async function QrPage() {
  const user = await requireFamilyUser();
  const furnitureList = await getAllFurnitures(user.familyId);

  if (furnitureList.length === 0) {
    return (
      <EmptyState
        icon={<QrCode className="size-8" />}
        title="Todavía no hay muebles"
        description="Cuando crees un mueble se le genera automáticamente su código QR."
      />
    );
  }

  return <QrSheet furnitures={furnitureList} isAdmin={user.role === "ADMIN"} />;
}
