import { NextResponse, type NextRequest } from "next/server";

// Pages anyone can open. Everything else needs a signed-in session (a demo account or your own).
const PUBLIC_PAGES = ["/login", "/signup", "/join/", "/reset/"];

/**
 * Sends a visitor without a session to the sign-in page, remembering where they were going.
 * The real check happens on the server for every request (row level security); this only decides
 * which page to show first. The session cookies are httpOnly, so their presence is all that is read here.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isPublic = PUBLIC_PAGES.some((p) => pathname === p || (p.endsWith("/") && pathname.startsWith(p)));
  const hasSession = req.cookies.has("bs-rt") || req.cookies.has("bs-at");

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // pages only: not the API (it answers 401 itself), Next's own files, or static files with an extension
  matcher: ["/((?!api/|_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
