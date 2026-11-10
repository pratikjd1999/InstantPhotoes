"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/admin/ui";

// Section links for screens narrower than xl, where the header has no room for them. Opens as a panel under the header.
export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="xl:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-primary transition-colors hover:bg-surface-high"
      >
        <Icon name={open ? "close" : "menu"} className="text-[24px]" />
      </button>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Sections"
          className="absolute inset-x-0 top-full border-t border-outline/60 bg-surface-lowest shadow-lg"
        >
          <ul className="mx-auto flex max-w-7xl flex-col px-6 py-3 lg:px-12">
            {items.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-3 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
