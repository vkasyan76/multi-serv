// src/modules/profile/server/services/vies.ts
import "server-only";

export type ViesResult = {
  countryCode: string;
  vatNumber: string;
  valid: boolean; // unified flag
  name?: string | null;
  address?: string | null;
  requestDate?: string;
  requestIdentifier?: string;
  normalizedVat: string;
};

type ViesJson =
  | {
      countryCode?: string;
      vatNumber?: string;
      valid?: boolean; // REST variant
      name?: string | null;
      address?: string | null;
      requestDate?: string;
      requestIdentifier?: string;
    }
  | {
      countryCode?: string;
      vatNumber?: string;
      isValid?: boolean; // “check-vat-number” variant
      name?: string | null;
      address?: string | null;
      requestDate?: string;
      requestIdentifier?: string;
    };

const BASE = "https://ec.europa.eu/taxation_customs/vies";
const normalize = (s: string) => s.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

export async function checkVat(
  countryCode: string,
  vat: string,
  signal?: AbortSignal
): Promise<ViesResult> {
  const raw = countryCode.toUpperCase();
  const cc = raw === "GR" ? "EL" : raw; // VIES quirk: EL, not GR
  const id = normalize(vat);

  // NOTE: fixed extra spaces you had before “countryCode=”
  const candidates = [
    `${BASE}/rest-api/ms/${encodeURIComponent(cc)}/vat/${encodeURIComponent(id)}`,
    `${BASE}/rest-api/check-vat-number?countryCode=${encodeURIComponent(cc)}&vatNumber=${encodeURIComponent(id)}`,
  ];

  for (const url of candidates) {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    });

    // Only use 2xx JSON responses, otherwise try the next candidate.
    if (!res.ok) continue;

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) continue;

    const rawUnknown = (await res.json()) as unknown;

    if (rawUnknown && typeof rawUnknown === "object") {
      const raw = rawUnknown as ViesJson;

      const valid =
        typeof (raw as { valid?: boolean }).valid === "boolean"
          ? (raw as { valid: boolean }).valid
          : !!(raw as { isValid?: boolean }).isValid;

      const unified: ViesResult = {
        countryCode: raw.countryCode ?? cc,
        vatNumber: raw.vatNumber ?? id,
        valid,
        name: raw.name ?? null,
        address: raw.address ?? null,
        requestDate: raw.requestDate,
        requestIdentifier: raw.requestIdentifier,
        normalizedVat: id,
      };

      return unified;
    }
  }

  throw new Error("VIES: all endpoints failed (non-JSON or non-2xx).");
}

export async function checkVatWithTimeout(
  countryCode: string,
  vat: string,
  timeoutMs = 8000
) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await checkVat(countryCode, vat, ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}
