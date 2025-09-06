// src/lib/app-auth.ts
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const secret = new TextEncoder().encode(process.env.APP_BRIDGE_SECRET);
const ISS = "infinisimo/bridge";

export type BridgeClaims = JWTPayload & {
  uid: string;
  sid?: string;
};

export async function signBridgeToken(claims: BridgeClaims, ttlSec = 90) {
  const now = Math.floor(Date.now() / 1000);

  // Build a JWTPayload explicitly (no `any`)
  const payload: JWTPayload = {
    // your custom claims
    uid: claims.uid,
    ...(claims.sid ? { sid: claims.sid } : {}),
  };

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISS)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSec)
    .sign(secret);
}

export async function verifyBridgeToken(token: string) {
  const { payload } = await jwtVerify(token, secret, { issuer: ISS });
  // payload now includes `uid` (and maybe `sid`) because we set them
  return payload as BridgeClaims;
}
