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
  /\b(last|latest|recent|most\s+recent)\s+(payment|payments)\b/,
  /\b(payment|payments)\s+(last|latest|recent)\b/,
] as const;

const PAYMENT_OVERVIEW_PATTERNS = [
  /\bdid\s+i\s+pay\s+already\b/,
  /\bhave\s+i\s+paid\b/,
  /\bpaid\s+already\b/,
  /\bdo\s+i\s+have\s+(any\s+)?paid\s+(orders|bookings)\b/,
  /\bany\s+paid\s+(orders|bookings)\b/,
  /\bdo\s+i\s+have\s+unpaid\s+(orders|bookings)\b/,
  /\bwhat\s+payments\s+are\s+still\s+pending\b/,
  /\bwhich\s+payments\s+are\s+still\s+pending\b/,
  /\bhabe\s+ich\b.*\b(schon|bereits)\b.*\b(bezahlt|gezahlt)\b/,
  /\bhabe\s+ich\b.*\bunbezahlte\b.*\b(buchungen|auftrage|auftraege)\b/,
  /\bwelche\b.*\bzahlungen\b.*\b(ausstehend|offen)\b/,
  /\bai\s+je\b.*\b(deja\s+)?paye\b.*\b(commandes?|reservations?)\b/,
  /\bai\s+je\b.*\b(commandes|reservations)\b.*\b(impayees|non\s+payees)\b/,
  /\bquels?\b.*\bpaiements\b.*\b(en\s+attente|pendants)\b/,
  /\bho\s+gia\b.*\bpagato\b.*\b(ordine|ordini|prenotazione|prenotazioni)\b/,
  /\bho\b.*\b(ordini|prenotazioni)\b.*\b(non\s+pagat[ei])\b/,
  /\bquali\b.*\bpagamenti\b.*\b(in\s+attesa|pendenti)\b/,
  /\b(ya\s+)?he\s+pagado\b.*\b(pedidos?|reservas?)\b/,
  /\btengo\b.*\b(pedidos|reservas)\b.*\bsin\s+pagar\b/,
  /\bque\b.*\bpagos\b.*\b(pendientes|estan\s+pendientes)\b/,
  /\bja\b.*\bpaguei\b.*\b(pedidos?|reservas?)\b/,
  /\btenho\b.*\b(pedidos|reservas)\b.*\b(por\s+pagar|nao\s+pag[oa]s?)\b/,
  /\bquais\b.*\bpagamentos\b.*\b(pendentes|em\s+aberto)\b/,
  /\bczy\b.*\b(zaplacilem|zapłaciłem|zaplacilam|zapłaciłam|zaplacone|zapłacone)\b.*\b(zamowienie|zamówienie|zamowienia|zamówienia|rezerwacje?)\b/u,
  /\bczy\b.*\b(mam|posiadam)\b.*\b(nieoplacone|nieopłacone|nie\s+oplacone|nie\s+opłacone)\b.*\b(zamowienia|zamówienia|rezerwacje)\b/u,
  /\bktore\b.*\b(platnosci|płatności)\b.*\b(oczekuja|oczekują|sa\s+oczekujace|są\s+oczekujące|w\s+toku)\b/u,
  /\bam\b.*\bplatit\b.*\b(comanda|comenzi|rezervare|rezervari)\b/,
  /\bam\b.*\b(comenzi|rezervari)\b.*\b(neplatite|neachitate)\b/,
  /\bce\b.*\bplati\b.*\b(in\s+asteptare|pendente)\b/,
  /чи.*(вже|уже).*оплат.*(замовлення|бронювання)/u,
  /чи.*(маю|є).*неоплач.*(замовлення|бронювання)/u,
  /як.*оплат.*(очіку|в\s+очікуванні)/u,
] as const;

const STATUS_FILTER_PATTERNS = {
  canceled: [/\bcancel(?:ed|led)\b/, /\bstorniert\b/],
  requested: [
    /\brequested\b/,
    /\bawaiting\s+(provider\s+)?confirmation\b/,
    /\bpending\s+confirmation\b/,
  ],
  scheduled: [/\bscheduled\b/, /\bconfirmed\s+(orders?|bookings?)\b/],
  completed_or_accepted: [/\bcompleted\b/, /\baccepted\b/, /\bfinished\b/],
  payment_not_due: [/\bnot\s+due\b/, /\bnot\s+invoiced\b/],
  payment_pending: [
    /\bunpaid\b/,
    /\bnot\s+paid\b/,
    /\bpayment\s+pending\b/,
    /\bpending\s+payment\b/,
    /\binvoice\s+due\b/,
    /\boverdue\b/,
  ],
  paid: [/\bpaid\b/, /\bpaid\s+(orders?|bookings?)\b/],
} as const;

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

export function detectPaymentOverviewIntent(message: string) {
  const text = normalizeForIntent(message);
  if (!text) return false;

  // These are bounded overview questions only. Imperatives such as
  // "show unpaid bookings" stay in status-filtered candidate routing.
  return hasPattern(text, PAYMENT_OVERVIEW_PATTERNS);
}

export function detectCandidateStatusFilter(message: string) {
  const text = normalizeForIntent(message);
  if (!text) return undefined;

  if (
    /\bwhat\s+(does|do)\b.*\bmean\b/.test(text) ||
    /\bmeaning\s+of\b/.test(text)
  ) {
    return undefined;
  }

  const hasOrderOrBooking = hasTerm(text, ORDER_OR_BOOKING_TERMS);
  const hasPayment = hasTerm(text, PAYMENT_TERMS);
  if (!hasOrderOrBooking && !hasPayment) return undefined;

  for (const [filter, patterns] of Object.entries(STATUS_FILTER_PATTERNS)) {
    if (hasPattern(text, patterns)) {
      return filter as keyof typeof STATUS_FILTER_PATTERNS;
    }
  }

  return undefined;
}
