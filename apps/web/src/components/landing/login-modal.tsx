"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/admin/ui";
import { LoginCard } from "@/components/login-card";

// The login pop-up opens whenever the address ends in #login: the header "Log In" button links there, and /login
// redirects there (session expired, logged out). It stays mounted while closed so LoginCard can wake the database early.
export function LoginModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setOpen(window.location.hash === "#login");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  function close() {
    setOpen(false);
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-inverse-surface/40 p-4 backdrop-blur-sm ${open ? "" : "hidden"}`}
      onClick={(e) => e.target === e.currentTarget && close()}
      role="dialog"
      aria-modal="true"
      aria-label="Log in"
    >
      <div className="relative w-full max-w-md">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
        >
          <Icon name="close" className="text-[20px]" />
        </button>
        <LoginCard />
      </div>
    </div>
  );
}
