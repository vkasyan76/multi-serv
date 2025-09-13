// src/lib/app-auth.ts
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const RAW_SECRET = process.env.APP_BRIDGE_SECRET ?? "";
if (RAW_SECRET.length < 32) {
  throw new Error("APP_BRIDGE_SECRET must be set and at least 32 chars.");
}
const secret = new TextEncoder().encode(RAW_SECRET);
const ISS = "infinisimo/bridge";

export type BridgeClaims = JWTPayload & {
  uid: string;
  sid?: string;
};

export async function signBridgeToken(claims: BridgeClaims, ttlSec = 90) {
  const nowSec = Math.floor(Date.now() / 1000); // Convert to seconds

  // Build a JWTPayload explicitly (no `any`)
  const payload: JWTPayload = {
    // your custom claims
    uid: claims.uid,
    ...(claims.sid ? { sid: claims.sid } : {}),
  };

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISS)
    .setAudience("bridge")
    .setIssuedAt(nowSec)
    .setNotBefore("0s")
    .setExpirationTime(nowSec + ttlSec)
    .sign(secret);
}

export async function verifyBridgeToken(token: string) {
  const { payload: verifiedPayload } = await jwtVerify(token, secret, {
    issuer: ISS,
    audience: "bridge",
    clockTolerance: "2s",
  });
  return verifiedPayload as BridgeClaims;
}
