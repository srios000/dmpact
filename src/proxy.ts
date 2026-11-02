import { auth } from "@/lib/auth/server";

export default auth.middleware({ loginUrl: "/login" });

export const config = {
  matcher: ["/", "/commissions/:path*", "/settings/:path*"],
};
