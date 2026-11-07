import type { Metadata, Viewport } from "next";

// Guest pages (/e/[code], /g/[token]): mobile first, often on weak 4G at a venue.
// The icon font is cut down to the icons these pages use (Google Fonts `icon_names`, which must be sorted), so it stays
// a few KB instead of several hundred. Add a name here when a guest component starts using a new icon.
const ICONS = [
  "archive",
  "arrow_forward",
  "arrow_upward",
  "bolt",
  "calendar_today",
  "call",
  "check",
  "check_circle",
  "chevron_left",
  "chevron_right",
  "close",
  "download",
  "error",
  "face",
  "favorite",
  "hourglass_bottom",
  "hourglass_top",
  "info",
  "link_off",
  "location_on",
  "lock",
  "lock_open",
  "person",
  "photo_camera",
  "progress_activity",
  "public",
  "qr_code_scanner",
  "refresh",
  "search",
  "sync",
  "verified_user",
  "visibility_off",
].sort();

const ICON_FONT = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0..1,0&icon_names=${ICONS.join(",")}&display=block`;

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#fdf9f5" };

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href={ICON_FONT} precedence="default" />
      <div className="min-h-dvh bg-surface font-admin text-on-surface antialiased">{children}</div>
    </>
  );
}
