"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  LayoutGrid,
  LogOut,
  QrCode,
  Search,
  Shield,
  User as UserIcon,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme";
import { logoutAction } from "@/lib/actions/auth";
import { cn, initials } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/sectores", label: "Sectores", icon: LayoutGrid },
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: "/qr", label: "Códigos QR", icon: QrCode },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
  { href: "/cuenta", label: "Mi cuenta", icon: UserIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  user,
  familyName,
  children,
}: {
  user: { name: string; role: string };
  familyName: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = NAV.filter((item) => !item.adminOnly || user.role === "ADMIN");
  // En el celular el espacio es poco: dejamos las cuatro secciones más usadas.
  const mobileItems = items.filter((item) => item.href !== "/qr").slice(0, 5);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <LayoutGrid className="size-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold">StockHogar</span>
              {familyName ? (
                <span className="block text-xs text-muted">{familyName}</span>
              ) : null}
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-muted hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-2">
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link
              href="/cuenta"
              title={user.name}
              className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-foreground"
            >
              {initials(user.name)}
            </Link>
            <form action={logoutAction} className="hidden md:block">
              <button
                type="submit"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <LogOut className="size-4.5" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 md:pb-12">
        {children}
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.4]")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
