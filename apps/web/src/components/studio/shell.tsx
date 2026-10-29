"use client";

import { AppShell, type ShellConfig } from "@/components/admin/shell";

const PHOTOGRAPHER: ShellConfig = {
  area: "Photographer",
  roleLabel: "Photographer",
  crumb: "Studio",
  footnote: "Your events and galleries",
  nav: [
    { href: "/dashboard", label: "Dashboard", icon: "grid_view", exact: true },
    { href: "/dashboard/events", label: "Events", icon: "calendar_month" },
    { href: "/dashboard/profile", label: "Profile", icon: "badge" },
  ],
  account: { href: "/dashboard/profile", label: "Profile", icon: "person" },
};

export function StudioShell({ userName, studioName, children }: { userName: string; studioName: string; children: React.ReactNode }) {
  return (
    <AppShell config={PHOTOGRAPHER} userName={userName} subtitle={studioName}>
      {children}
    </AppShell>
  );
}
