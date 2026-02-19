import "server-only";

export function getReferralCookieOptions(isDelete = false) {
  const isProd = process.env.NODE_ENV === "production";
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim();

  return {
    path: "/",
    sameSite: "lax" as const,
    secure: isProd,
    httpOnly: true,
    ...(isDelete ? { maxAge: 0 } : {}),
    ...(isProd && root ? { domain: `.${root}` } : {}),
  };
}
