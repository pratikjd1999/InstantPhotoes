"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CameraIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { Icon, ToastProvider } from "./ui";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Exact match only (for an area's home link, e.g. /dashboard). */
  exact?: boolean;
}

export interface ShellConfig {
  /** aria-label of the sidebar navigation. */
  area: string;
  /** Badge under the logo and the role line in the user menu. */
  roleLabel: string;
  /** Breadcrumb root in the top bar. */
  crumb: string;
  /** Small print at the bottom of the sidebar. */
  footnote: string;
  nav: NavItem[];
  /** First item of the user menu. */
  account: { href: string; label: string; icon: string };
}

const ADMIN: ShellConfig = {
  area: "Admin",
  roleLabel: "Super Admin",
  crumb: "Platform Administration",
  footnote: "Platform administration",
  nav: [
    { href: "/admin/photographers", label: "Photographers", icon: "photo_camera_front" },
    { href: "/admin/events", label: "Events", icon: "event_available" },
    { href: "/admin/usage", label: "Usage", icon: "bar_chart_4_bars" },
    { href: "/admin/account", label: "Account", icon: "shield_person" },
  ],
  account: { href: "/admin/account", label: "Account", icon: "shield_person" },
};

export function AdminShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  return (
    <AppShell config={ADMIN} userName={userName}>
      {children}
    </AppShell>
  );
}

const isActive = (item: NavItem, pathname: string) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

/** Sidebar + top bar + user menu shared by the Super Admin and Photographer areas. */
export function AppShell({
  config,
  userName,
  subtitle,
  title,
  children,
}: {
  config: ShellConfig;
  userName: string;
  /** Second line under the name in the user menu; defaults to the role label. */
  subtitle?: string;
  /** Overrides the top-bar title (otherwise the active nav item's label). */
  title?: string;
  children: React.ReactNode;
}) {
  const NAV = config.nav;
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!userMenuRef.current?.contains(e.target as Node)) setUserMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setUserMenuOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen]);

  // Longest matching href wins, so /dashboard/events beats /dashboard.
  const current = [...NAV].sort((a, b) => b.href.length - a.href.length).find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));

  async function logout() {
    setSigningOut(true);
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  const sidebar = (
    <nav aria-label={config.area} className="flex flex-col gap-6">
      <div className="flex items-center gap-3 px-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
          <CameraIcon className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-headline-sm font-bold leading-tight tracking-tight text-primary">InstantPhotos</span>
          <span className="w-fit rounded-full bg-secondary-container px-2 py-0.5 text-label-sm font-semibold tracking-wide text-on-secondary-container">
            {config.roleLabel}
          </span>
        </div>
      </div>
      <div className="mx-3 h-px bg-outline" />
      <ul className="flex flex-col gap-1.5 px-1">
        {NAV.map((item) => {
          const active = isActive(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-label-md transition-colors ${
                  active
                    ? "bg-secondary-container font-semibold text-on-secondary-container"
                    : "text-on-surface-variant hover:bg-surface-high hover:text-on-surface"
                }`}
              >
                <Icon name={item.icon} className="text-[20px]" filled={active} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface font-admin text-on-surface antialiased">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col justify-between bg-surface-low px-4 py-6 shadow-[1px_0_8px_rgba(0,0,0,0.04)] lg:flex">
          {sidebar}
          <p className="px-3 text-label-sm text-on-surface-variant">{config.footnote}</p>
        </aside>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-inverse-surface/50" onClick={() => setMenuOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface-low px-4 py-6 shadow-xl">{sidebar}</aside>
          </div>
        )}

        <div className="lg:pl-72">
          <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between bg-surface/85 px-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl sm:px-8 lg:left-72">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-high lg:hidden"
              >
                <Icon name="menu" className="text-[24px]" />
              </button>
              <span className="hidden text-label-md text-on-surface-variant sm:inline">{config.crumb}</span>
              <Icon name="chevron_right" className="hidden text-[14px] text-on-surface-variant sm:inline" />
              <span className="truncate font-serif text-headline-sm font-medium tracking-tight">{title ?? current?.label ?? "Overview"}</span>
            </div>
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-label={`Account menu for ${userName}`}
                className="flex items-center gap-3 rounded-xl py-1 pl-2 pr-2 transition-colors hover:bg-surface-high focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="hidden flex-col text-right sm:flex">
                  <span className="text-label-md font-semibold leading-tight">{userName}</span>
                  <span className="text-label-sm font-medium leading-tight text-secondary">{subtitle ?? config.roleLabel}</span>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
                  <Icon name="person" className="text-[18px]" />
                </div>
                <Icon
                  name="expand_more"
                  className={`text-[20px] text-on-surface-variant transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl bg-surface-lowest py-1 shadow-xl ring-1 ring-outline"
                >
                  <div className="border-b border-outline/60 px-4 py-3 sm:hidden">
                    <p className="text-label-md font-semibold">{userName}</p>
                    <p className="text-label-sm text-secondary">{subtitle ?? config.roleLabel}</p>
                  </div>
                  <Link
                    role="menuitem"
                    href={config.account.href}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-label-md transition-colors hover:bg-surface-container"
                  >
                    <Icon name={config.account.icon} className="text-[18px] text-secondary" />
                    {config.account.label}
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={logout}
                    disabled={signingOut}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-label-md text-error transition-colors hover:bg-error-container/40 disabled:opacity-50"
                  >
                    <Icon name="logout" className="text-[18px]" />
                    {signingOut ? "Logging out..." : "Log out"}
                  </button>
                </div>
              )}
            </div>
          </header>

          <main className="min-h-screen px-4 pb-16 pt-24 sm:px-8">
            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
