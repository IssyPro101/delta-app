import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? "pipeline_session";

function isPublicPath(pathname: string) {
  return pathname === "/auth/signin" || pathname.startsWith("/oauth/");
}

export function proxy(request: NextRequest) {
  const session = request.cookies.get(sessionCookieName);
  const { pathname } = request.nextUrl;

  if (!session && !isPublicPath(pathname)) {
    const url = new URL("/auth/signin", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session && pathname === "/auth/signin") {
    return NextResponse.redirect(new URL("/pipeline", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|health).*)"],
};
