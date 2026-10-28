import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, homeForRole, verifySession } from "@/lib/session";

// First line of role separation (AUTH-9, AUTH-10). Pages and API handlers check again (AUTH-11).
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const go = (to: string) => NextResponse.redirect(new URL(to, req.url));

  const inAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const inDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  if (inAdmin || inDashboard) {
    if (!session) return go("/login");
    if (inAdmin && session.role !== "super_admin") return go("/dashboard");
    if (inDashboard && session.role !== "photographer") return go("/admin");
    return NextResponse.next();
  }

  // Logged-in users have no reason to see the landing or login page.
  if (session) return go(homeForRole(session.role));
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/dashboard/:path*"],
};
