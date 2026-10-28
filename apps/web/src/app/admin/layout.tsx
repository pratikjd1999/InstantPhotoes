import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { getServerSession } from "@/server/get-session";

// Material Symbols are the icon set used in the Stitch admin designs.
const ICON_FONT =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0..1,0&display=swap";

export const metadata = { title: "Admin — InstantPhotos", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Second check behind proxy.ts (AUTH-9, AUTH-11): the page itself refuses other roles.
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (session.role !== "super_admin") redirect("/dashboard");

  return (
    <>
      <link rel="stylesheet" href={ICON_FONT} precedence="default" />
      <AdminShell userName={session.name}>{children}</AdminShell>
    </>
  );
}
