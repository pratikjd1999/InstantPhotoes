"use client";

import { Icon } from "@/components/admin/ui";
import { ADMIN_CONTACT } from "@/lib/contact";

const FIELD =
  "w-full rounded-lg bg-surface-low px-4 py-2.5 text-body-md text-on-surface shadow-inner outline-none placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary";
const LABEL = "mb-1 block text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant";

const VOLUMES = ["1 – 10 events / year", "10 – 25 events / year", "25 – 60 events / year", "60+ events / year"];

// Nothing is stored: submitting opens WhatsApp to the admin with the details filled in.
export function ContactForm() {
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const line = (label: string, key: string) => {
      const v = String(f.get(key) ?? "").trim();
      return v ? `${label}: ${v}` : null;
    };
    const text = [
      "Hi, I'd like a walkthrough of InstantPhotos.",
      line("Name", "name"),
      line("Studio", "studio"),
      line("Email", "email"),
      line("Phone", "phone"),
      line("Events per year", "volume"),
      line("Message", "message"),
    ]
      .filter(Boolean)
      .join("\n");
    window.open(`${ADMIN_CONTACT.whatsappUrl}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className={LABEL}>
            Your name
          </label>
          <input id="contact-name" name="name" required className={FIELD} placeholder="Kabir Sharma" autoComplete="name" />
        </div>
        <div>
          <label htmlFor="contact-studio" className={LABEL}>
            Studio / brand name
          </label>
          <input id="contact-studio" name="studio" required className={FIELD} placeholder="The Heritage Shutter" autoComplete="organization" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-email" className={LABEL}>
            Email address
          </label>
          <input id="contact-email" name="email" type="email" className={FIELD} placeholder="kabir@studio.in" autoComplete="email" />
        </div>
        <div>
          <label htmlFor="contact-phone" className={LABEL}>
            WhatsApp / phone
          </label>
          <input id="contact-phone" name="phone" type="tel" required className={FIELD} placeholder="+91 98200 12345" autoComplete="tel" />
        </div>
      </div>
      <div>
        <label htmlFor="contact-volume" className={LABEL}>
          Events you shoot each year
        </label>
        <select id="contact-volume" name="volume" className={FIELD}>
          {VOLUMES.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="contact-message" className={LABEL}>
          Upcoming event or questions
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={3}
          className={FIELD}
          placeholder="Tell us about your upcoming season or anything you'd like to see..."
        />
      </div>
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3.5 text-label-md text-white shadow-md transition-all hover:bg-primary-container"
      >
        <span>Send on WhatsApp</span>
        <Icon name="send" className="text-[18px]" />
      </button>
      <p className="text-center text-body-sm text-on-surface-variant">Opens WhatsApp with your details filled in. Nothing is saved on this site.</p>
    </form>
  );
}
