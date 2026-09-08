import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

function requestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  if (!host) return null;

  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || request.nextUrl.protocol.slice(0, -1);
  return `${protocol}://${host}`;
}

export function proxy(request: NextRequest) {
  if (safeMethods.has(request.method) || request.nextUrl.pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const expectedOrigin = requestOrigin(request);
  const crossSite = fetchSite === "cross-site" || (origin && expectedOrigin && origin !== expectedOrigin);

  if (crossSite) {
    return NextResponse.json(
      { error: "Origem da requisição não permitida.", code: "INVALID_REQUEST_ORIGIN" },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
