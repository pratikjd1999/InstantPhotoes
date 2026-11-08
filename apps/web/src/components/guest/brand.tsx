import type { StudioBranding } from "@instantphotos/core";
import { Icon } from "@/components/admin/ui";
import { StudioProfileButton } from "./profile";

// Guest pages carry the photographer's branding, not ours (PRD §5.7 GST-1). Ours is only the small footer line.

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** "14 Dec 2026". Dates are calendar days, so format in UTC to get the same text on the server and the phone. */
export const fmtEventDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function StudioMark({ studio, size = "md" }: { studio: StudioBranding; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-12 w-12 text-[15px]" : "h-9 w-9 text-[12px]";
  if (studio.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={studio.logoUrl} alt="" className={`${box} shrink-0 rounded-full bg-surface-lowest object-cover shadow-sm ring-1 ring-outline`} />;
  }
  return (
    <div className={`${box} flex shrink-0 items-center justify-center rounded-full bg-primary font-serif font-semibold tracking-wider text-secondary-container shadow-sm`}>
      {initials(studio.studioName)}
    </div>
  );
}

/** G01/G04 header: logo and studio name on the left, the photographer's profile on the right. */
export function StudioHeader({ studio, profile = true }: { studio: StudioBranding; profile?: boolean }) {
  return (
    <header className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <StudioMark studio={studio} />
        <div className="flex min-w-0 flex-col">
          <span className="text-[10px] font-semibold uppercase leading-none tracking-widest text-secondary">Photographer</span>
          <span className="truncate text-body-sm font-semibold text-on-surface">{studio.studioName}</span>
        </div>
      </div>
      {profile && <StudioProfileButton studio={studio} />}
    </header>
  );
}

export function PoweredBy() {
  return (
    <footer className="flex items-center justify-center gap-1.5 py-5 text-on-surface-variant/70">
      <Icon name="photo_camera" filled className="text-[15px]" />
      <span className="text-[11px] font-semibold uppercase tracking-wider">Powered by InstantPhotos</span>
    </footer>
  );
}

const instagramUrl = (handle: string) => `https://instagram.com/${handle.replace(/^@/, "")}`;
const telUrl = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/** Phone, Instagram and website of the photographer, whichever they filled in. */
export const contactLinks = (studio: StudioBranding) =>
  [
    studio.phone && { href: telUrl(studio.phone), icon: "call", label: studio.phone, action: "Call" },
    studio.instagram && { href: instagramUrl(studio.instagram), icon: "photo_camera", label: `@${studio.instagram.replace(/^@/, "")}`, action: "Instagram" },
    studio.website && { href: studio.website, icon: "public", label: studio.website.replace(/^https?:\/\//, ""), action: "Website" },
  ].filter(Boolean) as { href: string; icon: string; label: string; action: string }[];

export function ContactLinks({ studio }: { studio: StudioBranding }) {
  return (
    <div className="flex flex-col gap-2">
      {contactLinks(studio).map((l) => (
        <a
          key={l.action}
          href={l.href}
          target={l.href.startsWith("tel:") ? undefined : "_blank"}
          rel="noreferrer"
          className="flex min-h-12 items-center justify-between gap-3 rounded-lg bg-surface-lowest px-3 transition-colors hover:bg-surface-low"
        >
          <span className="flex min-w-0 items-center gap-3">
            <Icon name={l.icon} className="text-[20px] text-secondary" />
            <span className="truncate text-label-md font-semibold text-on-surface">{l.label}</span>
          </span>
          <span className="shrink-0 text-label-sm font-semibold text-secondary">{l.action}</span>
        </a>
      ))}
    </div>
  );
}

export function ContactCard({ studio, title = "Your photographer" }: { studio: StudioBranding; title?: string }) {
  if (!contactLinks(studio).length) return null;
  return (
    <div className="w-full rounded-xl bg-surface-container p-4 text-left">
      <div className="mb-3 flex items-center gap-3">
        <StudioMark studio={studio} />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-secondary">{title}</p>
          <p className="truncate text-label-md font-semibold text-on-surface">{studio.studioName}</p>
        </div>
      </div>
      <ContactLinks studio={studio} />
    </div>
  );
}
