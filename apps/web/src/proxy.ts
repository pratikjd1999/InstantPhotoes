import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { homeForRole, type Role } from "@instantphotos/core";
import { auth } from "@/server/auth";

// First line of role separation (AUTH-9, AUTH-10). Pages and API handlers check again against the database (AUTH-11).
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const go = (to: string) => NextResponse.redirect(new URL(to, req.url));

  // Cheap check first: no session cookie means no database or cache lookup.
  const hasCookie = Boolean(getSessionCookie(req));
  const result = hasCookie ? await auth.api.getSession({ headers: req.headers }) : null;
  const role = (result?.user as { role?: Role; status?: string } | undefined)?.status === "active" ? (result!.user as { role: Role }).role : null;

  const inAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const inDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  if (inAdmin || inDashboard) {
    if (!role) return go("/login");
    if (inAdmin && role !== "super_admin") return go("/dashboard");
    if (inDashboard && role !== "photographer") return go("/admin");
    return NextResponse.next();
  }

  // Logged-in users have no reason to see the landing or login page.
  if (role) return go(homeForRole(role));
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/dashboard/:path*"],
};
