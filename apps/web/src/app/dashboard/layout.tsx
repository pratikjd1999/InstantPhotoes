import { redirect } from "next/navigation";
import { getProfile } from "@instantphotos/core";
import { StudioShell } from "@/components/studio/shell";
import { getServerSession } from "@/server/get-session";

const ICON_FONT =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0..1,0&display=swap";

export const metadata = { title: "Studio — InstantPhotos", robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Second check behind proxy.ts (AUTH-9, AUTH-11): only photographers, and only after the temporary password is replaced (AUTH-4).
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (session.role !== "photographer") redirect("/admin");
  if (session.mustChangePassword) redirect("/change-password");
  const profile = await getProfile(session.id);

  return (
    <>
      <link rel="stylesheet" href={ICON_FONT} precedence="default" />
      <StudioShell userName={profile.displayName || session.name} studioName={profile.studioName}>
        {children}
      </StudioShell>
    </>
  );
}
