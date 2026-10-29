import { redirect } from "next/navigation";
import { homeForRole } from "@instantphotos/core";
import { SetPasswordCard } from "@/components/studio/set-password-card";
import { getServerSession } from "@/server/get-session";

// P06: forced password change after logging in with a temporary password (AUTH-4).

const ICON_FONT =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0..1,0&display=swap";

export const metadata = { title: "Set a new password — InstantPhotos", robots: { index: false } };

export default async function ChangePasswordPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  // Only for accounts that still have a temporary password; everyone else changes it from their profile or account page.
  if (!session.mustChangePassword) redirect(homeForRole(session.role));

  return (
    <>
      <link rel="stylesheet" href={ICON_FONT} precedence="default" />
      <main className="flex min-h-screen items-center justify-center bg-surface p-6 font-admin text-on-surface antialiased">
        <SetPasswordCard />
      </main>
    </>
  );
}
