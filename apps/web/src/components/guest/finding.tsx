import type { StudioBranding } from "@instantphotos/core";
import { Icon } from "@/components/admin/ui";
import { PoweredBy, StudioHeader } from "./brand";

/** G03: shown while the selfie is checked and matched (GST-6: under 5 s). */
export function Finding({ studio, guestName }: { studio: StudioBranding; guestName: string }) {
  const first = guestName.trim().split(/\s+/)[0];
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden px-4" aria-busy="true">
      <div className="pointer-events-none absolute -top-16 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-secondary-container/25 blur-3xl" />
      <StudioHeader studio={studio} profile={false} />

      <div className="relative flex flex-1 flex-col items-center justify-center py-8">
        <div className="relative mb-8 flex h-56 w-56 items-center justify-center" aria-hidden="true">
          <svg className="absolute h-56 w-56 motion-safe:animate-[spin_24s_linear_infinite]" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="94" fill="none" stroke="#ECBF80" strokeDasharray="4 8" strokeWidth="1.2" />
            <circle cx="100" cy="100" r="88" fill="none" stroke="#7A5823" strokeOpacity="0.4" strokeWidth="0.75" />
            {[
              [100, 6],
              [100, 194],
              [6, 100],
              [194, 100],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.5" fill="#7A5823" />
            ))}
          </svg>
          <svg className="absolute h-40 w-40 motion-safe:animate-[spin_16s_linear_infinite_reverse]" viewBox="0 0 160 160">
            <g stroke="#3F0818" strokeOpacity="0.6" strokeWidth="1.5">
              <line x1="80" y1="20" x2="135" y2="105" />
              <line x1="135" y1="55" x2="80" y2="140" />
              <line x1="140" y1="105" x2="45" y2="125" />
              <line x1="80" y1="140" x2="25" y2="55" />
              <line x1="25" y1="105" x2="80" y2="20" />
              <line x1="20" y1="55" x2="115" y2="35" />
            </g>
            <circle cx="80" cy="80" r="70" fill="none" stroke="#3F0818" strokeOpacity="0.5" strokeDasharray="2 6" />
          </svg>
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-lowest/90 p-1 shadow-lg">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-linear-to-tr from-primary-container via-primary to-secondary">
              <Icon name="photo_camera" filled className="text-[30px] text-secondary-container" />
            </div>
          </div>
        </div>

        <h1 className="mb-2 text-center font-serif text-[1.75rem] leading-9 text-primary" role="status">
          Finding your photos…
        </h1>
        <p className="max-w-xs text-center text-body-md text-on-surface-variant">
          {first ? `Hi ${first}, we're` : "We're"} looking through the event photos for you.
        </p>
        <div className="mt-6 flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 text-on-surface-variant">
          <Icon name="hourglass_top" className="text-[16px] text-secondary" />
          <span className="text-body-sm">This usually takes less than 5 seconds.</span>
        </div>
      </div>
      <PoweredBy />
    </main>
  );
}
