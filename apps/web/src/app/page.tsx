import Image from "next/image";
import { LoginCard } from "@/components/login-card";
import {
  CameraIcon,
  ClockIcon,
  DownloadIcon,
  FaceIcon,
  GalleryIcon,
  InstagramIcon,
  LinkedInIcon,
  QrSelfieIcon,
  ShieldIcon,
  UploadIcon,
  WhatsAppIcon,
  XIcon,
  YouTubeIcon,
} from "@/components/icons";
import { ADMIN_CONTACT } from "@/lib/contact";

const STEPS = [
  { icon: UploadIcon, label: "Photographer uploads photos" },
  { icon: QrSelfieIcon, label: "Guest scans QR & takes selfie" },
  { icon: GalleryIcon, label: "Guest sees & downloads photos" },
];

// Only capabilities that are in the beta scope of the PRD.
const FEATURES = [
  {
    icon: FaceIcon,
    title: "Only the photos you're in",
    text: "Guests see their own photos, not a thousand others. Faces are matched from a single selfie.",
  },
  {
    icon: QrSelfieIcon,
    title: "One QR per event",
    text: "Print it or show it at the venue. Guests scan, take a selfie and they're in. No app to install.",
  },
  {
    icon: ClockIcon,
    title: "Live while the event runs",
    text: "Upload in batches during the event. New photos appear in guests' galleries as they're processed.",
  },
  {
    icon: ShieldIcon,
    title: "Private by design",
    text: "Each guest gets a private gallery link that expires after the event, with signed image links.",
  },
  {
    icon: DownloadIcon,
    title: "Download in one tap",
    text: "Save a single photo or the whole set. Photographers keep full-quality originals for editing.",
  },
];

// Placeholders: set `href` once the real profiles exist. Until then they render as plain labels, not links.
const SOCIALS: { icon: typeof XIcon; label: string; href?: string }[] = [
  { icon: InstagramIcon, label: "Instagram @instantphotos.in" },
  { icon: WhatsAppIcon, label: "WhatsApp Channel" },
  { icon: YouTubeIcon, label: "YouTube" },
  { icon: LinkedInIcon, label: "LinkedIn" },
  { icon: XIcon, label: "X (Twitter)" },
];

const PILL =
  "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-cream";

export default function Home() {
  return (
    <div className="hero-glow flex min-h-screen flex-col justify-between overflow-x-hidden">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 pb-3 pt-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brass/30 bg-wine text-cream shadow-md shadow-wine/20">
            <CameraIcon className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">InstantPhotos</span>
        </div>
        <a
          href="#login"
          className="rounded-lg bg-wine px-4 py-2 text-sm font-semibold text-cream shadow-sm transition-colors hover:bg-wine-dark lg:hidden"
        >
          Log in
        </a>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 py-2 sm:px-8 lg:py-3">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Left: hero. On mobile the hero comes first and the header "Log in" button jumps to the card. */}
          <div className="flex flex-col justify-center space-y-4 lg:col-span-7">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-brass/40 bg-parchment px-3.5 py-1 text-xs font-semibold text-wine">
                <span className="h-2 w-2 rounded-full bg-brass" />
                <span className="font-medium tracking-wide">Designed for wedding &amp; event photographers in India</span>
              </div>

              <h1 className="font-serif text-3xl font-semibold leading-[1.15] tracking-tight text-gray-950 sm:text-4xl lg:text-[42px]">
                Every guest gets their photos,{" "}
                <span className="inline-block -rotate-1 rounded-lg bg-wine px-3 py-0.5 italic text-cream shadow-lg shadow-wine/25 ring-1 ring-brass/40">instantly.</span>
              </h1>

              <p className="max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base lg:text-[15px]">
                Upload photos during the event. Guests scan a QR code, take a selfie, and see every photo they appear in.
              </p>
            </div>

            <div className="relative h-[170px] overflow-hidden rounded-2xl border border-line bg-white shadow-lg lg:h-[190px]">
              <Image
                src="/images/hero.jpg"
                alt="Wedding guests looking at their photos on a phone"
                fill
                priority
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="object-cover object-center"
              />
            </div>

            <ol className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
              {STEPS.map(({ icon: Icon, label }, i) => (
                <li
                  key={label}
                  className="flex items-start gap-3 rounded-xl border border-line bg-white/80 p-2.5 shadow-sm backdrop-blur-sm transition-colors hover:border-brass/60"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brass/30 bg-parchment text-wine">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-wine">
                      Step 0{i + 1}
                    </span>
                    <p className="text-xs font-semibold leading-tight text-gray-900">{label}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Right: login card */}
          <div id="login" className="flex scroll-mt-6 flex-col justify-center lg:col-span-5">
            <LoginCard />
          </div>
        </div>
      </main>

      <section className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 sm:px-8">
        <div className="flex flex-col justify-between gap-2 border-b border-line pb-3 sm:flex-row sm:items-end">
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-wine">How it helps</span>
            <h2 className="font-serif text-xl font-semibold text-gray-950 sm:text-2xl">
              Built for events where everyone wants their photos
            </h2>
          </div>
          <span className="text-xs font-medium text-gray-500">No app download for guests</span>
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="rounded-xl border border-line bg-white/85 p-4 transition-all duration-200 hover:border-brass/60 hover:shadow-md"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-brass/30 bg-parchment text-wine">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 text-sm font-bold text-gray-900">{title}</h3>
              <p className="text-xs leading-relaxed text-gray-600">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 pb-8 sm:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-wine px-6 py-8 text-cream shadow-xl shadow-wine/20 sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brass/20 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brass" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-brass">Contact us for access</h2>
              </div>
              <p className="mt-3 font-serif text-2xl font-semibold sm:text-3xl">
                {ADMIN_CONTACT.name} · {ADMIN_CONTACT.phoneDisplay}
              </p>
              <p className="mt-2 text-sm text-cream/70">Access is invite-only during beta.</p>
              <a
                href={ADMIN_CONTACT.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-whatsapp px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-whatsapp-dark"
              >
                <WhatsAppIcon className="h-5 w-5" />
                <span>Chat on WhatsApp</span>
              </a>
            </div>

            <div className="lg:border-l lg:border-white/15 lg:pl-12">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brass">Connect with InstantPhotos</h3>
              <p className="mt-2 text-sm text-cream/70">Follow our photography creator community and live wedding showcases.</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {SOCIALS.map(({ icon: Icon, label, href }) => (
                  <li key={label}>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${PILL} transition-colors hover:border-brass hover:bg-white/15`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </a>
                    ) : (
                      <span className={PILL}>
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-7xl border-t border-line/60 px-5 py-3 text-xs font-medium text-gray-500 sm:px-8">
        © InstantPhotos
      </footer>
    </div>
  );
}
