const RECENCY_TERMS = [
  "last",
  "latest",
  "recent",
  "most recent",
  "letzte",
  "letzter",
  "letztes",
  "neuste",
  "neueste",
  "aktuell",
  "aktuelles",
  "dernier",
  "derniere",
  "recent",
  "recente",
  "ultimo",
  "ultima",
  "ultime",
  "reciente",
  "ostatni",
  "ostatnia",
  "ostatnie",
  "najnowsze",
  "ultimul",
  "recenta",
  "останне",
  "остання",
  "останнии",
  "нещодавне",
] as const;

const ORDER_OR_BOOKING_TERMS = [
  "order",
  "orders",
  "booking",
  "bookings",
  "reservation",
  "reservations",
  "buchung",
  "buchungen",
  "auftrag",
  "commande",
  "commandes",
  "reservation",
  "reservations",
  "ordine",
  "ordini",
  "prenotazione",
  "prenotazioni",
  "pedido",
  "pedidos",
  "reserva",
  "reservas",
  "zamowienie",
  "zamowienia",
  "rezerwacja",
  "rezerwacje",
  "comanda",
  "comenzi",
  "rezervare",
  "rezervari",
  "замовлення",
  "бронювання",
] as const;

const PAYMENT_TERMS = [
  "payment",
  "paid",
  "pay",
  "zahlung",
  "bezahlt",
  "paiement",
  "paye",
  "pagamento",
  "pagato",
  "pago",
  "pagamento",
  "platnosc",
  "oplacone",
  "plata",
  "platit",
  "оплата",
  "оплачено",
] as const;

const DIRECT_VAGUE_ACCOUNT_PATTERNS = [
  /\bfind\s+my\s+(order|booking)\b/,
  /\bwhat\s+happened\s+with\s+my\s+(order|booking)\b/,
  /\bwhy\s+has\s+my\s+(order|booking)\s+not\s+been\s+paid\b/,
  /\bwith\s+this\s+provider\b/,
  /\bprovider\s+name\b/,
] as const;

const PAYMENT_CANDIDATE_PATTERNS = [
  /\b(my\s+)?payment\s+go\s+through\b/,
  /\bdid\s+my\s+payment\b/,
  /\bcheck\s+my\s+payment\b/,
] as const;

function normalizeForIntent(message: string) {
  return message
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’'`]/g, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasTerm(text: string, terms: readonly string[]) {
  return terms.some((term) => new RegExp(`\\b${term}\\b`, "u").test(text));
}

function hasPattern(text: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function detectCandidateSelectionIntent(message: string) {
  const text = normalizeForIntent(message);
  if (!text) return false;

  const hasOrderOrBooking = hasTerm(text, ORDER_OR_BOOKING_TERMS);
  const hasRecency = hasTerm(text, RECENCY_TERMS);

  if (hasOrderOrBooking && hasRecency) return true;
  if (hasOrderOrBooking && hasPattern(text, DIRECT_VAGUE_ACCOUNT_PATTERNS)) {
    return true;
  }

  // Payment-only phrasing may show order candidates, but only for narrow
  // "my payment" style questions. Broad payment lists remain blocked upstream.
  return hasTerm(text, PAYMENT_TERMS) && hasPattern(text, PAYMENT_CANDIDATE_PATTERNS);
}
