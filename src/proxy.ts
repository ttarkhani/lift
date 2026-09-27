import { NextResponse, type NextRequest } from "next/server";
import { getAuth0, isAuth0Configured } from "@/server/auth/auth0";

// Serves /auth/login, /auth/logout, /auth/callback, and /auth/profile, and keeps the
// session rolling. It is never the only access check: every route and page checks on the server.
export async function proxy(request: NextRequest) {
  if (!isAuth0Configured()) {
    if (request.nextUrl.pathname.startsWith("/auth/")) {
      return new NextResponse("Sign-in isn't set up. Add the Auth0 values to .env.local (see docs/auth0-setup.md).", {
        status: 503,
      });
    }
    return NextResponse.next();
  }
  return getAuth0().middleware(request);
}

export const config = {
  matcher: [
    // Everything except Next's static files, metadata files, files with an extension, and the health check.
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/health|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
