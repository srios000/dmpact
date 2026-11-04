import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { clientLinkExists } from "@/lib/repositories/agreement-repository";

const CLIENT_LINK_NOT_FOUND = "/a/link-not-found";

const requireCreator = auth.middleware({ loginUrl: "/login" });

export default async function proxy(request: NextRequest) {
  const [, segment, token] = request.nextUrl.pathname.split("/");
  if (segment === "a" && token !== undefined) {
    return (await clientLinkExists(token))
      ? NextResponse.next()
      : NextResponse.rewrite(new URL(CLIENT_LINK_NOT_FOUND, request.url));
  }
  return requireCreator(request);
}

export const config = {
  matcher: ["/", "/commissions/:path*", "/settings/:path*", "/a/:token"],
};
