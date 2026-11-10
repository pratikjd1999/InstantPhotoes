import Image from "next/image";
import { Icon } from "@/components/admin/ui";
import { CameraIcon, InstagramIcon, LinkedInIcon, WhatsAppIcon, XIcon, YouTubeIcon } from "@/components/icons";
import { ContactForm } from "@/components/landing/contact-form";
import { LoginModal } from "@/components/landing/login-modal";
import { MobileNav } from "@/components/landing/mobile-nav";
import { ADMIN_CONTACT } from "@/lib/contact";

// Landing page, from the Stitch screen "final - InstantPhotos — Professional AI Photo Sharing Platform".
// The copy only describes what the product does today.

const ICON_FONT =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0..1,0&display=swap";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#everywhere", label: "Use Cases" },
  { href: "#brand", label: "Brand & Studio" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Contact" },
];

const BADGES = [
  { icon: "face", title: "Selfie match", text: "Every photo they're in" },
  { icon: "devices", title: "Zero App Download", text: "Opens in the browser" },
  { icon: "bolt", title: "Live at the event", text: "Upload while you shoot" },
  { icon: "shield", title: "Private galleries", text: "Links expire after the event" },
];

const FEATURES = [
  {
    icon: "face",
    title: "AI Face Recognition",
    text: "Each guest takes one selfie and sees only the photos they appear in, from close portraits to group shots and candids, out of the whole event.",
    note: "Matched from a single selfie",
  },
  {
    icon: "cloud_upload",
    title: "Live Uploads",
    text: "Upload in batches while the event is still on. Each photo is processed as it arrives and reaches the guests who are in it.",
    note: "Drag and drop from any browser",
  },
  {
    icon: "verified_user",
    title: "Your Studio Brand",
    text: "Guest pages show your studio name, logo and cover, with a profile that links to your Instagram, website and contact details.",
    note: "Turn guests into enquiries",
  },
  {
    icon: "qr_code_2",
    title: "Printable QR Cards",
    text: "Every event gets its own QR code. Download it as a print-ready card (PNG or PDF) for standees and tables, or share the link on WhatsApp.",
    note: "One QR per event",
  },
  {
    icon: "lock",
    title: "Private by Design",
    text: "Each guest gets a private gallery that closes on the date you choose. Location and camera data are removed from the copies guests see.",
    note: "Guests can hide any photo with “Not me”",
  },
];

const STEPS = [
  {
    title: "Get your studio login",
    tag: "Free to start",
    tagTone: "green",
    text: "We set up your photographer account during early access. Log in from any browser, nothing to install.",
  },
  {
    title: "Create an event and upload your photos",
    tag: "Batch uploads",
    tagTone: "gold",
    text: "Add the event name, date and how long the gallery stays open, then drag in your JPEGs, during or after the event.",
  },
  {
    title: "Faces are found automatically",
    tag: "Automatic",
    tagTone: "green",
    text: "Every photo is processed as soon as it's uploaded: faces are detected and matched to guests who have registered.",
  },
  {
    title: "Share the link or QR code with guests",
    tag: "No app needed",
    tagTone: "gold",
    text: "Guests scan the table card, take a selfie and get their own private gallery right away.",
  },
] as const;

const GUEST_STEPS = [
  {
    icon: "frame_person",
    title: "Scan & Snap a Selfie",
    text: "Guests scan the QR code and take a quick selfie in their browser. No app downloads, no passwords.",
  },
  {
    icon: "event_available",
    title: "Automatic Face Matching",
    text: "Their selfie is matched against every photo in the event, and new photos keep arriving as you upload.",
  },
  {
    icon: "photo_library",
    title: "Download & Keep",
    text: "Save a single photo or download the whole set at once, and open the gallery again later on a new phone.",
  },
];

const BRAND_CARDS = [
  {
    icon: "palette",
    title: "Customizable Brand Experience",
    text: "Add your studio name, logo, cover image and contact details once, and they appear on the guest pages of every event.",
  },
  {
    icon: "language",
    title: "Your clients see you",
    text: "Guests can open your photographer profile right from their gallery, with your Instagram, website and phone, so they can follow and hire you.",
  },
  {
    icon: "qr_code_2",
    title: "Branded QR Cards",
    text: "The printable QR card for each event carries your studio name, ready for standees, table cards and invitations.",
  },
];

const PLANS = [
  {
    name: "Single Event",
    tag: "Regular Tier",
    price: "₹0",
    was: "₹2,999",
    off: "100% Off",
    blurb: "Weddings, galas, corporate events or campus festivals",
    items: [
      "Up to 15,000 photos",
      "Unlimited guest selfies & face matches",
      "Printable QR card (PNG & PDF)",
      "Live uploads during the event",
      "Zero platform fees during Early Bird",
    ],
    cta: { label: "Coming Soon" },
  },
  {
    name: "Studio Pro (Full Suite)",
    tag: "Free of Cost",
    price: "₹0",
    was: "₹8,999/mo",
    off: "Early Bird Free Access",
    blurb: "Full early access for pioneer studios & photographers",
    items: [
      "0 Platform Fees · 100% Free of Cost",
      "Unlimited events",
      "AI face recognition on every photo",
      "Your studio branding & profile on guest pages",
      "Private galleries with expiry dates",
      "No Credit Card Required",
    ],
    cta: { label: "Claim Free Early Bird Access", href: "#contact" },
    featured: true,
  },
  {
    name: "Production Houses",
    tag: "VIP Pilot",
    price: "Free Pilot",
    blurb: "Multi-city studios, event planners & agencies",
    items: [
      "High-volume events",
      "Studio branding on every gallery",
      "Priority WhatsApp support",
      "Help setting up your first events",
      "Complimentary 1-on-1 walkthrough",
    ],
    cta: { label: "Enterprise Waitlist Only" },
  },
];

const HIGHLIGHTS = [
  { value: "0", label: "Apps to install", text: "Guests use their phone's browser" },
  { value: "1", label: "Selfie per guest", text: "Finds every photo they're in" },
  { value: "1", label: "QR per event", text: "Print it or share the link" },
  { value: "₹0", label: "During early access", text: "No credit card required" },
  { value: "100%", label: "Private links", text: "Each guest sees only their photos" },
];

const FAQS = [
  {
    q: "Do guests need to download an app?",
    a: "No. Guests point their phone camera at the QR code, or tap the link you share on WhatsApp. InstantPhotos opens in their normal browser (Safari or Chrome), they take a quick selfie, and their photos appear.",
  },
  {
    q: "How well does face matching work at real events?",
    a: "It finds guests in portraits, group photos and candids, including side angles and evening lighting, as long as the face is reasonably visible. Faces that are very small, heavily blurred or turned away may be missed. If a photo shows up that isn't them, a guest can hide it with “Not me”.",
  },
  {
    q: "Can I upload while the event is still going on?",
    a: "Yes. Upload in batches from any browser whenever you like. Each photo is processed as it arrives and appears in the galleries of the guests who are in it, including guests who registered earlier.",
  },
  {
    q: "Are the photos kept private?",
    a: "Each guest sees only the photos they're matched in, through their own private link. Galleries close on the date you set for the event. The copies guests see have location and camera data removed, and your full-quality originals stay with you.",
  },
];

// Placeholders: set `href` once the real profiles exist. Until then they render as plain icons, not links.
const SOCIALS: { icon: typeof XIcon; label: string; href?: string }[] = [
  { icon: InstagramIcon, label: "Instagram" },
  { icon: WhatsAppIcon, label: "WhatsApp Channel" },
  { icon: YouTubeIcon, label: "YouTube" },
  { icon: LinkedInIcon, label: "LinkedIn" },
  { icon: XIcon, label: "X" },
];

const EYEBROW = "block text-label-sm font-bold uppercase tracking-wider text-secondary";
const H2 = "font-serif text-[1.75rem] leading-9 text-primary lg:text-headline-lg";
const LEAD = "text-lg leading-7 text-on-surface-variant";
const PILL_GREEN = "rounded-full bg-[#c5ecc9] px-2.5 py-0.5 text-label-sm font-semibold text-tertiary";
const PILL_GOLD = "rounded-full bg-secondary-container px-2.5 py-0.5 text-label-sm font-semibold text-on-secondary-container";

function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span
        className={`flex items-center justify-center rounded-lg bg-primary text-white shadow-sm ${small ? "h-9 w-9" : "h-10 w-10"}`}
      >
        <CameraIcon className={small ? "h-4 w-4" : "h-5 w-5"} />
      </span>
      <span className="font-serif text-headline-sm font-semibold tracking-tight text-primary">InstantPhotos</span>
    </span>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-surface font-admin text-on-surface antialiased">
      <link rel="stylesheet" href={ICON_FONT} precedence="default" />

      <header className="fixed top-0 z-50 w-full bg-surface/85 shadow-[0_1px_8px_rgba(42,31,34,0.05)] backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-6 lg:px-12">
          <a href="#hero" className="flex items-center gap-2" aria-label="InstantPhotos home">
            <Logo />
            <span className="hidden rounded-full bg-secondary-container px-2 py-0.5 text-label-sm font-semibold uppercase tracking-wider text-on-secondary-container sm:inline-flex">
              AI Delivery
            </span>
          </a>
          <nav aria-label="Sections" className="hidden items-center gap-8 xl:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-label-md text-on-surface-variant transition-colors hover:text-primary">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a
              href="#login"
              className="rounded-lg bg-primary px-5 py-2.5 text-label-md text-white shadow-sm transition-all duration-200 hover:bg-primary-container"
            >
              Log In
            </a>
            <MobileNav items={NAV} />
          </div>
        </div>
      </header>

      <main className="w-full pt-20">
        {/* Hero */}
        <section id="hero" className="relative scroll-mt-20 overflow-hidden py-12 lg:py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="flex justify-center md:justify-start">
              <div className="mb-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-secondary-container px-3.5 py-1.5 text-on-secondary-container shadow-sm">
                <Icon name="celebration" className="text-[16px] text-secondary" />
                <span className="text-label-sm font-bold uppercase tracking-wider">Early Bird Offer: Full Platform Access, Free of Cost</span>
                <span className="hidden text-secondary/60 md:inline">·</span>
                <span className="hidden text-body-sm font-semibold md:inline">No Credit Card Required</span>
              </div>
            </div>

            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
              <div className="flex flex-col items-start text-left lg:col-span-7">
                <h1 className="font-serif text-[2.25rem] leading-[1.12] tracking-tight text-primary lg:text-[3.5rem]">
                  Every event guest gets their photos, <span className="font-light italic text-secondary">instantly.</span>
                </h1>
                <p className={`${LEAD} mt-6 max-w-2xl`}>
                  AI face recognition photo sharing for weddings, corporate events, college fests, concerts and celebrations. Guests
                  scan a QR code, take a selfie, and see every photo they appear in, while you're still uploading.
                </p>
                <div className="mt-8 flex w-full flex-wrap items-center gap-4 sm:w-auto">
                  <a
                    href="#pricing"
                    className="flex items-center justify-center gap-2.5 rounded-lg bg-primary px-7 py-3.5 text-label-md text-white shadow-md transition-all hover:bg-primary-container"
                  >
                    <span>Get Free Early Bird Access — ₹0</span>
                    <Icon name="bolt" className="text-[18px]" />
                  </a>
                  <a
                    href="#how-it-works"
                    className="flex items-center justify-center gap-2 rounded-lg bg-surface-high px-6 py-3.5 text-label-md text-primary transition-all hover:bg-surface-highest"
                  >
                    <Icon name="play_circle" className="text-[18px]" />
                    <span>See How It Works</span>
                  </a>
                </div>
                <div className="mt-10 grid w-full grid-cols-1 gap-3 border-t border-outline/60 pt-6 sm:grid-cols-2">
                  {BADGES.map((b) => (
                    <div
                      key={b.title}
                      className="group flex items-center gap-3 rounded-xl border border-outline bg-surface-lowest p-3.5 shadow-sm transition-all hover:border-secondary/60"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                        <Icon name={b.icon} className="text-[20px]" />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-label-md font-bold text-on-surface">{b.title}</span>
                        <span className="text-[12px] leading-tight text-on-surface-variant">{b.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Illustrative guest-gallery preview */}
              <div className="relative lg:col-span-5">
                <div className="relative mx-auto max-w-sm rounded-2xl bg-surface-container p-3 shadow-2xl">
                  <div className="overflow-hidden rounded-xl bg-surface-lowest shadow-sm">
                    <div className="flex items-center justify-between bg-surface-low p-3">
                      <div className="flex items-center gap-2">
                        <Icon name="visibility" className="text-[18px] text-secondary" />
                        <span className="text-label-sm font-semibold uppercase tracking-wider text-on-surface">Live Event Preview</span>
                      </div>
                      <span className={PILL_GREEN}>100% Ready</span>
                    </div>
                    <div className="relative h-64 w-full">
                      <Image
                        src="/images/landing/hero-mandap.jpg"
                        alt="Wedding mandap by a lake at sunset, decorated with marigolds and roses"
                        fill
                        priority
                        sizes="384px"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-primary/90 via-primary/30 to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4 text-white">
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-label-sm uppercase tracking-wider text-white">Grand Vivah</span>
                        <h2 className="mt-1 font-serif text-headline-sm font-semibold leading-snug text-white">Dev &amp; Ananya Royal Celebration</h2>
                        <div className="mt-1 flex items-center gap-1.5 text-body-sm text-on-primary-container">
                          <Icon name="location_on" className="text-[16px]" />
                          <span>Udaipur</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-surface-lowest p-4">
                      <div className="mb-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-surface-low p-2.5 text-center">
                          <span className="block text-body-sm text-on-surface-variant">Photos</span>
                          <span className="text-label-md font-bold text-on-surface">3,240 ready</span>
                        </div>
                        <div className="rounded-lg bg-surface-low p-2.5 text-center">
                          <span className="block text-body-sm text-on-surface-variant">Guests</span>
                          <span className="text-label-md font-bold text-primary">412 registered</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-container p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container">
                            <Icon name="face" className="text-[22px] text-secondary" />
                          </div>
                          <div>
                            <p className="text-label-sm font-semibold text-on-surface">Selfie matched</p>
                            <p className="text-body-sm text-on-surface-variant">Across the whole event</p>
                          </div>
                        </div>
                        <a href="#how-it-works" className="shrink-0 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-label-sm text-white">
                          View (42)
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <span className={EYEBROW}>Features Suite</span>
                <h2 className={`${H2} mt-2`}>Engage, Share, Impress</h2>
                <p className={`${LEAD} mt-3 max-w-xl`}>Built for photographers, studios, event organisers and hosts.</p>
              </div>
              <span className={`${PILL_GOLD} w-fit px-3.5 py-1.5`}>Upload &amp; Face AI</span>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-xl bg-surface-lowest p-8 shadow-sm transition-shadow hover:shadow-md">
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-container text-white">
                    <Icon name={f.icon} className="text-[24px]" />
                  </div>
                  <h3 className="font-serif text-headline-sm font-semibold text-primary">{f.title}</h3>
                  <p className="mt-3 text-body-md leading-relaxed text-on-surface-variant">{f.text}</p>
                  <div className="mt-6 flex items-center gap-2 pt-4 text-label-md text-secondary">
                    <span>{f.note}</span>
                    <Icon name="arrow_forward" className="text-[16px]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="mx-auto mb-14 max-w-2xl text-center lg:mb-16">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary-container px-3.5 py-1.5 text-on-secondary-container shadow-sm">
                <Icon name="conversion_path" className="text-[16px] text-secondary" />
                <span className="text-label-sm font-bold uppercase tracking-wider">Simple 4-Step Process</span>
              </div>
              <h2 className={`${H2} tracking-tight`}>How It Works</h2>
              <p className={`${LEAD} mt-2`}>From setting up the event to guests holding their photos, in four steps.</p>
            </div>
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
              <div className="relative flex items-center justify-center lg:col-span-5">
                <div className="relative isolate w-full max-w-md lg:max-w-none">
                  <div className="absolute -inset-4 -z-10 rounded-2xl bg-secondary-container/50 sm:-inset-6" />
                  <div className="relative overflow-hidden rounded-2xl border-4 border-surface-lowest bg-surface-lowest shadow-2xl">
                    <Image
                      src="/images/landing/photographers.jpg"
                      alt="Two photographers reviewing event photos on a tablet"
                      width={1024}
                      height={1024}
                      sizes="(min-width: 1024px) 40vw, 100vw"
                      className="h-115 w-full object-cover object-center sm:h-130"
                    />
                  </div>
                </div>
              </div>
              <ol className="space-y-4 lg:col-span-7">
                {STEPS.map((s, i) => (
                  <li
                    key={s.title}
                    className="group flex items-start gap-4 rounded-2xl border border-outline/60 bg-surface-low p-5 shadow-sm transition-all hover:border-secondary/60 hover:bg-surface-lowest sm:gap-5 sm:p-6"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary font-serif text-headline-sm font-bold text-white shadow-sm transition-transform group-hover:scale-105">
                      0{i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-serif text-headline-sm font-semibold text-primary">{s.title}</h3>
                        <span className={s.tagTone === "green" ? PILL_GREEN : PILL_GOLD}>{s.tag}</span>
                      </div>
                      <p className="text-body-md leading-relaxed text-on-surface-variant">{s.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section id="everywhere" className="relative scroll-mt-20 overflow-hidden bg-surface-low py-20 lg:py-28">
          <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-12">
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <span className={`${EYEBROW} mb-2`}>Every Moment Captured</span>
              <h2 className={`${H2} mb-3`}>InstantPhotos is Everywhere</h2>
              <p className={LEAD}>
                Weddings, corporate summits, graduations, concerts, marathons and family celebrations: anywhere a photographer shoots and
                guests want their photos.
              </p>
            </div>
            <div className="mx-auto max-w-5xl">
              <div className="relative overflow-hidden rounded-2xl border border-outline/60 bg-surface-lowest p-2 shadow-2xl sm:p-3">
                <Image
                  src="/images/landing/events-collage.jpg"
                  alt="Collage of weddings, graduations, music festivals, summits and sports events"
                  width={1376}
                  height={768}
                  sizes="(min-width: 1024px) 64rem, 100vw"
                  className="h-auto w-full rounded-xl object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Guest experience + studios */}
        <section className="py-20 lg:py-28">
          <div className="mx-auto max-w-7xl space-y-24 px-6 lg:space-y-32 lg:px-12">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="relative flex items-center justify-center lg:col-span-6">
                <div className="relative isolate w-full max-w-lg">
                  <div className="absolute -left-8 -top-6 -z-10 h-64 w-64 rounded-[45%_55%_65%_35%/50%_60%_40%_50%] bg-[#f5cb42]/85 sm:h-72 sm:w-72" />
                  <div className="relative overflow-hidden rounded-2xl border border-outline/50 bg-surface-lowest shadow-2xl">
                    <Image
                      src="/images/landing/face-scan.jpg"
                      alt="A guest at an outdoor event smiling at a face recognition screen"
                      width={1408}
                      height={768}
                      sizes="(min-width: 1024px) 32rem, 100vw"
                      className="h-80 w-full object-cover object-center sm:h-96"
                    />
                    <div className="pointer-events-none absolute left-[44%] top-[38%] h-24 w-20">
                      <div className="relative h-full w-full rounded-sm border border-sky-400/80">
                        <div className="absolute -left-1 -top-1 h-2.5 w-2.5 border-l-2 border-t-2 border-sky-400" />
                        <div className="absolute -right-1 -top-1 h-2.5 w-2.5 border-r-2 border-t-2 border-sky-400" />
                        <div className="absolute -bottom-1 -left-1 h-2.5 w-2.5 border-b-2 border-l-2 border-sky-400" />
                        <div className="absolute -bottom-1 -right-1 h-2.5 w-2.5 border-b-2 border-r-2 border-sky-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-start lg:col-span-6">
                <span className={`${EYEBROW} mb-2`}>Seamless Guest Experience</span>
                <h2 className={`${H2} mb-3`}>Guests Find Every Photo With One Selfie</h2>
                <div className="mb-10 h-1 w-16 rounded-full bg-[#f5cb42]" />
                <div className="w-full space-y-8">
                  {GUEST_STEPS.map((s) => (
                    <div key={s.title} className="flex items-start gap-5">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-800 shadow-sm">
                        <Icon name={s.icon} className="text-[26px]" />
                      </div>
                      <div>
                        <h3 className="font-serif text-headline-sm font-semibold text-primary">{s.title}</h3>
                        <p className="mt-1.5 text-body-md leading-relaxed text-on-surface-variant">{s.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="flex flex-col items-start lg:col-span-6">
                <span className={`${EYEBROW} mb-2`}>Built for Event Studios</span>
                <h2 className={`${H2} mb-3`}>Elevate Your Studio with Same-Day Delivery</h2>
                <div className="mb-8 h-1 w-16 rounded-full bg-[#f5cb42]" />
                <div className="space-y-5 text-body-md leading-relaxed text-on-surface-variant">
                  <p className="text-lg font-medium text-on-surface">
                    Capturing great photos is only half the job. Delivering them while the celebration is still going delights clients and
                    saves you from sorting photos for each guest afterwards.
                  </p>
                  <p>
                    Upload from any browser, let face matching do the sorting, and put your studio name, logo and profile in front of every
                    guest who opens their gallery.
                  </p>
                </div>
                <a
                  href="#pricing"
                  className="mt-8 inline-flex items-center gap-2 text-label-md font-bold text-primary underline decoration-2 underline-offset-4 transition-colors hover:text-secondary"
                >
                  Explore Studio Plans →
                </a>
              </div>
              <div className="relative flex items-center justify-center lg:col-span-6">
                <div className="relative isolate w-full max-w-md sm:max-w-lg">
                  <div className="absolute -inset-4 -z-10 overflow-hidden rounded-full bg-[#f5cb42] sm:-inset-6">
                    <div className="h-full w-full rounded-full border-10 border-white/25" />
                  </div>
                  <div className="relative aspect-square overflow-hidden rounded-full border-4 border-white shadow-2xl">
                    <Image
                      src="/images/landing/photographer.jpg"
                      alt="Event photographer shooting at a gala dinner"
                      fill
                      sizes="(min-width: 640px) 32rem, 100vw"
                      className="scale-105 object-cover object-top transition-transform duration-500 hover:scale-110"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Brand */}
        <section id="brand" className="scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <span className={`${EYEBROW} mb-2`}>Brand Visibility</span>
              <h2 className={`${H2} mb-3`}>Showcase Your Brand, Not Ours</h2>
              <p className={LEAD}>Every gallery you deliver introduces your studio to a room full of potential clients.</p>
            </div>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {BRAND_CARDS.map((c) => (
                <div key={c.title} className="space-y-4 rounded-2xl border border-outline bg-surface-lowest p-8 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-container text-white">
                    <Icon name={c.icon} className="text-[24px]" />
                  </div>
                  <h3 className="font-serif text-headline-sm font-semibold text-primary">{c.title}</h3>
                  <p className="text-body-md leading-relaxed text-on-surface-variant">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <span className={EYEBROW}>Limited Time Early Bird Access · Free for Pilot Studios</span>
              <h2 className={`${H2} mt-2`}>Free of Cost as an Early Bird Offer</h2>
              <p className={`${LEAD} mt-3`}>
                During early access, every feature and unlimited events are free of charge. No credit card required.
              </p>
            </div>
            <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-3">
              {PLANS.map((p) => (
                <div
                  key={p.name}
                  className={`relative flex flex-col justify-between rounded-2xl p-8 ${
                    p.featured ? "bg-surface-lowest shadow-xl ring-2 ring-primary" : "bg-surface-low shadow-sm"
                  }`}
                >
                  {p.featured && (
                    <div className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary px-4 py-1 text-label-sm font-semibold uppercase tracking-wider text-white shadow-sm">
                      <Icon name="stars" className="text-[16px]" />
                      <span>Early Bird Launch Pass · 100% Free</span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-label-sm font-semibold uppercase tracking-wider text-secondary">{p.name}</span>
                      <span className={p.featured ? PILL_GREEN : "rounded-full bg-surface-high px-2.5 py-1 text-label-sm text-on-surface-variant"}>
                        {p.tag}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-baseline gap-2">
                      <h3 className={`font-serif text-headline-md text-primary ${p.featured ? "font-bold" : ""}`}>{p.price}</h3>
                      {p.was ? (
                        <span className="text-body-md text-on-surface-variant line-through">{p.was}</span>
                      ) : (
                        <span className="text-body-sm text-on-surface-variant">(Early Bird)</span>
                      )}
                      {p.off && <span className={`${PILL_GOLD} py-0.5`}>{p.off}</span>}
                    </div>
                    <p className="mt-1 text-body-sm text-on-surface-variant">{p.blurb}</p>
                    <ul className={`mt-8 space-y-3.5 text-body-sm ${p.featured ? "text-on-surface" : "text-on-surface-variant"}`}>
                      {p.items.map((it) => (
                        <li key={it} className="flex items-center gap-2.5">
                          <Icon name="check_circle" className="text-[18px] text-primary" />
                          <span>{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-8">
                    {p.cta.href ? (
                      <a
                        href={p.cta.href}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3.5 text-label-md text-white shadow-md transition-all hover:bg-primary-container"
                      >
                        <span>{p.cta.label}</span>
                        <Icon name="arrow_forward" className="text-[18px]" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-full rounded-lg bg-surface-container py-3 text-label-md text-on-surface-variant/50 shadow-sm"
                      >
                        {p.cta.label}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 bg-surface-low py-16 lg:py-24">
          <div className="mx-auto max-w-4xl px-6 lg:px-12">
            <div className="mb-12 text-center">
              <span className={EYEBROW}>Clear Answers</span>
              <h2 className={`${H2} mt-2`}>Frequently Asked Questions</h2>
              <p className="mt-2 text-body-md text-on-surface-variant">What photographers and guests ask us most.</p>
            </div>
            <div className="space-y-4">
              {FAQS.map((f) => (
                <details key={f.q} className="group rounded-xl bg-surface-lowest p-6 shadow-sm">
                  <summary className="flex list-none items-center justify-between gap-4 text-left [&::-webkit-details-marker]:hidden">
                    <h3 className="text-label-md font-semibold text-primary">{f.q}</h3>
                    <Icon name="expand_more" className="text-[22px] text-secondary transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 pt-3 text-body-md leading-relaxed text-on-surface-variant">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Highlights */}
        <section className="bg-surface-low py-12">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <span className={EYEBROW}>Made Simple</span>
              <h2 className="mt-1 font-serif text-headline-md text-primary">Built for How Events Actually Run</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5 lg:gap-6">
              {HIGHLIGHTS.map((h, i) => (
                <div
                  key={h.label}
                  className={`rounded-xl bg-surface-lowest p-6 text-center shadow-sm ${i === HIGHLIGHTS.length - 1 ? "col-span-2 md:col-span-1" : ""}`}
                >
                  <div className="font-serif text-headline-lg font-semibold text-primary">{h.value}</div>
                  <p className="mt-1 text-label-sm font-semibold uppercase tracking-wider text-secondary">{h.label}</p>
                  <p className="mt-1.5 text-body-sm text-on-surface-variant">{h.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-5">
                <span className={EYEBROW}>Talk to Us</span>
                <h2 className={H2}>Let&apos;s discuss your next celebration</h2>
                <p className="text-body-md leading-relaxed text-on-surface-variant">
                  Access is invite-only during early access. Tell us about your studio and we&apos;ll set up your account and walk you
                  through your first event.
                </p>
                <a
                  href={ADMIN_CONTACT.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl bg-surface-low p-4 shadow-sm transition-colors hover:bg-surface-container"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-whatsapp text-white">
                      <WhatsAppIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-label-md font-semibold text-on-surface">Chat on WhatsApp</h3>
                      <p className="text-body-sm text-on-surface-variant">
                        {ADMIN_CONTACT.phoneDisplay} ({ADMIN_CONTACT.name})
                      </p>
                    </div>
                  </div>
                  <Icon name="open_in_new" className="text-[20px] text-secondary" />
                </a>
              </div>
              <div className="rounded-2xl bg-surface-lowest p-8 shadow-lg lg:col-span-7 lg:p-10">
                <h3 className="font-serif text-headline-sm font-semibold text-primary">Schedule a 1-on-1 Studio Walkthrough</h3>
                <p className="mb-6 mt-1 text-body-sm text-on-surface-variant">See face matching work on photos from one of your own events.</p>
                <ContactForm />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full bg-surface-low">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-12">
          <div className="grid grid-cols-1 gap-10 pb-12 md:grid-cols-2 lg:grid-cols-5">
            <div className="flex flex-col gap-4 lg:col-span-2">
              <Logo small />
              <p className="max-w-sm text-body-md text-on-surface-variant">
                Private AI face recognition and instant photo delivery for weddings, celebrations and the photographers who capture them.
              </p>
              <ul className="flex items-center gap-3 pt-2">
                {SOCIALS.map(({ icon: SocialIcon, label, href }) => {
                  const cls = "flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant";
                  return (
                    <li key={label}>
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={`${cls} transition-colors hover:bg-surface-high hover:text-primary`}>
                          <SocialIcon className="h-4 w-4" />
                        </a>
                      ) : (
                        <span title={label} className={cls}>
                          <SocialIcon className="h-4 w-4" />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-label-md font-semibold uppercase tracking-wider text-on-surface">Platform</span>
              <a className="text-body-sm text-on-surface-variant transition-colors hover:text-primary" href="#features">Face Recognition AI</a>
              <a className="text-body-sm text-on-surface-variant transition-colors hover:text-primary" href="#how-it-works">How It Works</a>
              <a className="text-body-sm text-on-surface-variant transition-colors hover:text-primary" href="#pricing">Photographer Plans</a>
              <a className="text-body-sm text-on-surface-variant transition-colors hover:text-primary" href="#brand">Studio Branding</a>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-label-md font-semibold uppercase tracking-wider text-on-surface">Resources</span>
              <a className="text-body-sm text-on-surface-variant transition-colors hover:text-primary" href="#faq">FAQ</a>
              <a className="text-body-sm text-on-surface-variant transition-colors hover:text-primary" href="#contact">Book a Walkthrough</a>
              <a className="text-body-sm text-on-surface-variant transition-colors hover:text-primary" href="#login">Photographer Login</a>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-label-md font-semibold uppercase tracking-wider text-on-surface">Contact</span>
              <a
                href={ADMIN_CONTACT.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-body-sm text-on-surface-variant transition-colors hover:text-primary"
              >
                <WhatsAppIcon className="h-4 w-4" />
                <span>
                  WhatsApp: {ADMIN_CONTACT.phoneDisplay} ({ADMIN_CONTACT.name})
                </span>
              </a>
            </div>
          </div>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-outline/60 pt-8 text-body-sm text-on-surface-variant md:flex-row">
            <p>© {new Date().getFullYear()} InstantPhotos. All rights reserved.</p>
            <a
              className="group inline-flex items-center gap-1.5 rounded-full border border-outline/60 bg-surface-lowest px-3.5 py-1.5 text-label-sm font-bold tracking-wide text-primary shadow-sm transition-all duration-300 hover:bg-primary hover:text-white"
              href="https://vincerecorp.in"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>
                Developed by{" "}
                <span className="text-secondary underline decoration-1 underline-offset-2 transition-colors group-hover:text-secondary-container">
                  vincerecorp.in
                </span>
              </span>
              <Icon name="arrow_outward" className="text-[14px]" />
            </a>
          </div>
        </div>
      </footer>

      <LoginModal />
    </div>
  );
}
