import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getFurnitureIdByToken } from "@/lib/queries";

/**
 * Destino de los códigos QR pegados en los muebles.
 * Si la persona no inició sesión, la mandamos a ingresar y después vuelve acá.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/m/[token]">,
) {
  const { token } = await params;
  const target = await getFurnitureIdByToken(token);
  const user = await getCurrentUser();

  if (!user) {
    const next = target ? `/muebles/${target.id}` : "/";
    return NextResponse.redirect(
      new URL(`/ingresar?next=${encodeURIComponent(next)}`, _request.url),
    );
  }

  if (!target || target.familyId !== user.familyId) {
    return NextResponse.redirect(new URL("/qr-desconocido", _request.url));
  }

  return NextResponse.redirect(new URL(`/muebles/${target.id}`, _request.url));
}
