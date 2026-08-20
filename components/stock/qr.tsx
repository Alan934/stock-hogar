"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, Printer, QrCode, RefreshCw } from "lucide-react";

import { useOrigin } from "@/components/hooks";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { regenerateQrAction } from "@/lib/actions/stock";

/** Arma el link que va adentro del QR usando el origen desde el que se navega. */
export function useFurnitureUrl(token: string) {
  const origin = useOrigin();
  const base = origin || process.env.NEXT_PUBLIC_APP_URL || "";
  return base ? `${base}/m/${token}` : "";
}

export function useQrDataUrl(text: string, size = 640) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!text) return;
    let alive = true;

    import("qrcode")
      .then((mod) =>
        (mod.default ?? mod).toDataURL(text, {
          width: size,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#101a1f", light: "#ffffff" },
        }),
      )
      .then((url) => {
        if (alive) setDataUrl(url);
      })
      .catch(() => {
        if (alive) setDataUrl(null);
      });

    return () => {
      alive = false;
    };
  }, [text, size]);

  return dataUrl;
}

export function QrImage({
  token,
  className,
  size = 640,
}: {
  token: string;
  className?: string;
  size?: number;
}) {
  const url = useFurnitureUrl(token);
  const dataUrl = useQrDataUrl(url, size);

  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-surface-2 ${className ?? ""}`}
      >
        <QrCode className="size-8 animate-pulse text-muted" />
      </div>
    );
  }

  return (
    // El QR es una imagen generada en el navegador: next/image no aporta acá.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="Código QR del mueble"
      className={className}
      width={size}
      height={size}
    />
  );
}

export function QrButton({
  furniture,
  isAdmin,
}: {
  furniture: { id: string; name: string; qrToken: string };
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <QrCode className="size-4" />
        Código QR
      </Button>
      <QrDialog
        open={open}
        onClose={() => setOpen(false)}
        furniture={furniture}
        isAdmin={isAdmin}
      />
    </>
  );
}

export function QrDialog({
  open,
  onClose,
  furniture,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  furniture: { id: string; name: string; qrToken: string };
  isAdmin: boolean;
}) {
  const url = useFurnitureUrl(furniture.qrToken);
  const dataUrl = useQrDataUrl(url);
  const { notify } = useToast();
  const router = useRouter();
  const [working, setWorking] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      notify("Link copiado.", "success");
    } catch {
      notify("No pudimos copiar el link.", "error");
    }
  }

  function print() {
    if (!dataUrl) return;

    const sheet = window.open("", "_blank", "width=420,height=580");
    if (!sheet) {
      notify("Permití las ventanas emergentes para imprimir.", "error");
      return;
    }

    const safeName = furniture.name.replace(
      /[&<>"]/g,
      (char) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char,
    );

    sheet.document.write(
      `<!doctype html><html lang="es"><head><meta charset="utf-8">` +
        `<title>QR ${safeName}</title></head>` +
        `<body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;text-align:center">` +
        `<img src="${dataUrl}" style="width:70mm;height:70mm" alt="">` +
        `<h1 style="font-size:18px;margin:8px 0 2px">${safeName}</h1>` +
        `<p style="font-size:11px;color:#666;margin:0">Escaneá para ver y descontar el stock</p>` +
        `</body></html>`,
    );
    sheet.document.close();
    sheet.focus();
    sheet.addEventListener("load", () => {
      sheet.print();
      sheet.close();
    });
  }

  async function regenerate() {
    setWorking(true);
    const result = await regenerateQrAction(furniture.id);
    setWorking(false);
    notify(
      result.ok ? (result.message ?? "Listo.") : (result.error ?? "Error"),
      result.ok ? "success" : "error",
    );
    if (result.ok) {
      onClose();
      router.refresh();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`QR de ${furniture.name}`}
      description="Pegalo en el mueble: al escanearlo se abre esta misma pantalla."
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex justify-center rounded-2xl border border-border bg-white p-4">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt={`Código QR de ${furniture.name}`}
              className="size-56"
            />
          ) : (
            <div className="flex size-56 items-center justify-center">
              <QrCode className="size-10 animate-pulse text-muted" />
            </div>
          )}
        </div>

        <p className="break-all rounded-xl bg-surface-2 px-3 py-2 text-center text-xs text-muted">
          {url || "Generando…"}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={copy}>
            <Copy className="size-4" />
            Copiar link
          </Button>
          <Button variant="secondary" onClick={print}>
            <Printer className="size-4" />
            Imprimir
          </Button>
        </div>

        {dataUrl ? (
          <a
            href={dataUrl}
            download={`qr-${furniture.name.toLowerCase().replace(/\s+/g, "-")}.png`}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Download className="size-4" />
            Descargar PNG
          </a>
        ) : null}

        {isAdmin ? (
          <Button
            variant="ghost"
            className="w-full text-danger hover:bg-danger-soft"
            loading={working}
            onClick={regenerate}
          >
            <RefreshCw className="size-4" />
            Generar un código nuevo
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}
