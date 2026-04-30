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
  "bestellung",
  "bestellungen",
  "auftrag",
  "auftrage",
  "auftraege",
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
  "comenzile",
  "rezervare",
  "rezervari",
  "rezervarile",
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
  "platnosci",
  "oplacone",
  "plata",
  "platit",
  "platii",
  "оплата",
  "оплачено",
] as const;

const INVOICE_TERMS = [
  "invoice",
  "invoices",
  "rechnung",
  "rechnungen",
  "facture",
  "factures",
  "fattura",
  "fatture",
  "factura",
  "facturas",
  "fatura",
  "faturas",
  "faktura",
  "faktury",
  "рахунок",
  "рахунки",
] as const;

const ORDER_STATUS_INTENT_PATTERNS = [
  /\b(order|booking)\s+status\b/,
  /\b(status|estado|statut|stato|statusul|stan)\b.*\b(order|booking|buchung|buchungen|bestellung|bestellungen|auftrag|auftrage|auftraege|commande|commandes|reservation|reservations|ordine|ordini|prenotazione|prenotazioni|pedido|pedidos|reserva|reservas|zamowienie|zamowienia|rezerwacja|rezerwacje|comanda|comenzi|comenzii|rezervare|rezervari)\b/,
  /\b(order|booking|buchung|buchungen|bestellung|bestellungen|auftrag|auftrage|auftraege|commande|commandes|reservation|reservations|ordine|ordini|prenotazione|prenotazioni|pedido|pedidos|reserva|reservas|zamowienie|zamowienia|rezerwacja|rezerwacje|comanda|comenzi|rezervare|rezervari)\b.*\b(status|estado|statut|stato|statusul|stan)\b/,
  /статус.*(замовлення|бронювання)/u,
  /(замовлення|бронювання).*статус/u,
] as const;

const PAYMENT_STATUS_INTENT_PATTERNS = [
  /\bpayment\s+status\b/,
  /\bzahlungsstatus\b/,
  /\b(status|estado|statut|stato|statusul|stan)\b.*\b(payment|zahlungen?|paiements?|pagamenti?|pagos?|pagamentos?|platnosci|plata|plati|platii)\b/,
  /\b(payment|zahlungen?|paiements?|pagamenti?|pagos?|pagamentos?|platnosci|plata|plati|platii)\b.*\b(status|estado|statut|stato|statusul|stan)\b/,
  /\b(my\s+)?payment\s+go\s+through\b/,
  /\bcheck\s+(my\s+)?payment\b/,
  /статус.*(оплати|платежу)/u,
  /(оплати|платежу).*статус/u,
] as const;

const CANCEL_ELIGIBILITY_INTENT_PATTERNS = [
  /\b(can|could)\s+i\b.*\b(cancel|cancelable)\b.*\b(order|booking)\b/,
  /\b(cancel|cancelable)\b.*\b(order|booking)\b/,
  /\b(stornieren|stornierbar)\b.*\b(buchung|buchungen|bestellung|bestellungen|auftrag|auftrage|auftraege)\b/,
  /\b(buchung|buchungen|bestellung|bestellungen|auftrag|auftrage|auftraege)\b.*\b(stornieren|stornierbar)\b/,
  /\b(annuler|annulable)\b.*\b(commandes?|reservations?)\b/,
  /\b(commandes?|reservations?)\b.*\b(annuler|annulable)\b/,
  /\bannull\w+\b.*\b(ordine|ordini|prenotazione|prenotazioni)\b/,
  /\b(ordine|ordini|prenotazione|prenotazioni)\b.*\bannull\w+\b/,
  /\b(cancel\w+|anular)\b.*\b(pedidos?|reservas?)\b/,
  /\b(pedidos?|reservas?)\b.*\b(cancel\w+|anular)\b/,
  /\banul\w+\b.*\b(zamowienie|zamowienia|rezerwacje?|comanda|comenzi|rezervare|rezervari|rezervarea)\b/u,
  /\b(zamowienie|zamowienia|rezerwacje?|comanda|comenzi|rezervare|rezervari|rezervarea)\b.*\banul\w+\b/u,
  /скасувати.*(замовлення|бронювання)/u,
  /(замовлення|бронювання).*скасувати/u,
] as const;

const BROAD_OR_DEFERRED_INTENT_PATTERNS = [
  /\bhistory\b/,
  /\bexport\b/,
  /\ball\s+(my\s+)?(orders|payments|invoices|bookings)\b/,
  /\bshow\s+all\s+(my\s+)?(orders|payments|invoices|bookings)\b/,
  /\b(alle|verlauf|historie|exportieren)\b.*\b(buchungen|bestellungen|auftrage|auftraege|zahlungen|rechnungen)\b/,
  /\bafficher\b.*\b(toutes?|tous)\b.*\b(commandes|reservations|paiements|factures)\b/,
  /\b(historique|exporter)\b.*\b(commandes|reservations|paiements|factures)\b/,
  /\bmostra\b.*\b(tutti|tutte)\b.*\b(ordini|prenotazioni|pagamenti|fatture)\b/,
  /\b(cronologia|esporta)\b.*\b(ordini|prenotazioni|pagamenti|fatture)\b/,
  /\bmostrar\b.*\b(todos|todas)\b.*\b(pedidos|reservas|pagos|facturas)\b/,
  /\b(historial|exportar)\b.*\b(pedidos|reservas|pagos|facturas)\b/,
  /\bmostrar\b.*\b(todos|todas)\b.*\b(pedidos|reservas|pagamentos|faturas)\b/,
  /\b(historico|exportar)\b.*\b(pedidos|reservas|pagamentos|faturas)\b/,
  /\bpokaz\b.*\bwszystkie\b.*\b(zamowienia|rezerwacje|platnosci|faktury)\b/,
  /\b(historia|eksport)\b.*\b(zamowienia|rezerwacje|platnosci|faktury)\b/,
  /\barata\b.*\btoate\b.*\b(comenzile|rezervarile|platile|facturile)\b/,
  /\b(istoric|export)\b.*\b(comenzile|rezervarile|platile|facturile)\b/,
  /показати.*(всі|усі).*(замовлення|бронювання|оплати|рахунки)/u,
  /(історія|експортувати).*(замовлення|бронювання|оплати|рахунки)/u,
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
  canceled: [
    /\bcancel(?:ed|led)\b/,
    /\bstorniert\b/,
    /\bstornierte[nrms]?\b/,
    /\bannulees?\b/,
    /\bannullat[ei]\b/,
    /\bcancelad[ao]s?\b/,
    /\banulowane\b/,
    /\banulat[ae]\b/,
    /скасован/u,
  ],
  requested: [
    /\brequested\b/,
    /\bawaiting\s+(provider\s+)?confirmation\b/,
    /\bpending\s+confirmation\b/,
    /\bwart(?:et|en)\b.*\b(bestatigung|bestaetigung)\b/,
    /\ben\s+attente\b.*\bconfirmation\b/,
    /\battendent\b.*\bconfirmation\b/,
    /\battendono\b.*\bconferma\b/,
    /\besperan\b.*\bconfirmacion\b/,
    /\baguardam\b.*\bconfirmacao\b/,
    /\bczekaja\b.*\bpotwierdzenie\b/,
    /\basteapta\b.*\bconfirmarea\b/,
    /очіку.*підтвердж/u,
  ],
  scheduled: [
    /\bscheduled\b/,
    /\bconfirmed\s+(orders?|bookings?)\b/,
    /\bgeplant\b/,
    /\bprogramm\w+\b/,
    /\bprogram\w+\b/,
    /\bagendadas?\b/,
    /\bzaplanowane\b/,
    /\bprogramate\b/,
    /запланован/u,
  ],
  completed_or_accepted: [
    /\bcompleted\b/,
    /\baccepted\b/,
    /\bfinished\b/,
    /\babgeschlossen\b/,
    /\bterminees?\b/,
    /\bcompletat[ei]\b/,
    /\bcompletad[ao]s?\b/,
    /\bconcluid[ao]s?\b/,
    /\bzakonczone\b/,
    /\bfinalizate\b/,
    /завершен/u,
  ],
  payment_not_due: [
    /\bnot\s+due\b/,
    /\bnot\s+invoiced\b/,
    /\bnicht\s+fallig\b/,
    /\bpas\s+encore\s+du\b/,
    /\bnon\s+dovuto\b/,
    /\bno\s+vence\b/,
    /\bnao\s+vence\b/,
    /\bnie\s+wymagalna\b/,
    /\bnu\s+este\s+scadenta\b/,
    /ще.*не.*підлягає/u,
  ],
  payment_pending: [
    /\bunpaid\b/,
    /\bnot\s+paid\b/,
    /\bpayment\s+pending\b/,
    /\bpending\s+payment\b/,
    /\binvoice\s+due\b/,
    /\boverdue\b/,
    /\bunbezahlt\w*\b/,
    /\bimpayees?\b/,
    /\bnon\s+pagat[ei]\b/,
    /\bsin\s+pagar\b/,
    /\bpor\s+pagar\b/,
    /\bnieoplacone\b/,
    /\bneplatite\b/,
    /неоплачен/u,
  ],
  paid: [
    /\bpaid\b/,
    /\bpaid\s+(orders?|bookings?)\b/,
    /\bbezahlt\b/,
    /\bpayees?\b/,
    /\bpagat[ei]\b/,
    /\bpagad[ao]s?\b/,
    /\bpagos?\b/,
    /\bzaplacone\b/,
    /\boplacone\b/,
    /\bplatite\b/,
    /\bachitate\b/,
    /оплачен/u,
  ],
} as const;

const SELECTED_ORDER_PAYMENT_FOLLOW_UP_PATTERNS = [
  /\bwhat\s+about\b.*\bpayment\b/,
  /\bpayment\b/,
  /\bpaid\b/,
  /\bpay\b/,
  /\bdue\b/,
  /\binvoice\b/,
  /\bzahlung\b/,
  /\bpaiement\b/,
  /\bpagamento\b/,
  /\bpago\b/,
  /\bpagamentos?\b/,
  /\bplatnosc\b/,
  /\bplata\b/,
  /\bplati\b/,
  /оплат/u,
] as const;

const SELECTED_ORDER_STATUS_FOLLOW_UP_PATTERNS = [
  /\bstatus\b/,
  /\bestado\b/,
  /\bstatut\b/,
  /\bstato\b/,
  /\bstatusul\b/,
  /\bstan\b/,
  /\breason\b/,
  /\bnext\s+step\b/,
  /\bwhat\s+happened\b/,
  /\bgrund\b/,
  /\braison\b/,
  /\bmotivo\b/,
  /\brazon\b/,
  /\bpowod\b/,
  /\bmotiv\b/,
  /статус|причин|далі/u,
] as const;

const SELECTED_ORDER_CANCEL_FOLLOW_UP_PATTERNS = [
  /\bcancel\b/,
  /\bstornier\w+\b/,
  /\bannuler\b/,
  /\bannull\w+\b/,
  /\bcancel\w+\b/,
  /\banular\b/,
  /\banulowac\b/,
  /\banul\w+\b/,
  /скасувати/u,
] as const;

function normalizeForIntent(message: string) {
  return message
    .toLocaleLowerCase()
    .replace(/[łŁ]/g, "l")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’'`]/g, " ")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegexTerm(term: string) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasTerm(text: string, terms: readonly string[]) {
  return terms.some((term) =>
    new RegExp(`(?:^|\\s)${escapeRegexTerm(term)}(?:$|\\s)`, "u").test(text),
  );
}

function hasPattern(text: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function detectOrderStatusIntent(message: string) {
  const text = normalizeForIntent(message);
  if (!text) return false;
  return hasPattern(text, ORDER_STATUS_INTENT_PATTERNS);
}

export function detectPaymentStatusIntent(message: string) {
  const text = normalizeForIntent(message);
  if (!text) return false;
  return hasPattern(text, PAYMENT_STATUS_INTENT_PATTERNS);
}

export function detectCancelEligibilityIntent(message: string) {
  const text = normalizeForIntent(message);
  if (!text) return false;
  return hasPattern(text, CANCEL_ELIGIBILITY_INTENT_PATTERNS);
}

export function detectBroadOrDeferredIntent(message: string) {
  const text = normalizeForIntent(message);
  if (!text) return false;
  const hasAccountObject =
    hasTerm(text, ORDER_OR_BOOKING_TERMS) ||
    hasTerm(text, PAYMENT_TERMS) ||
    hasTerm(text, INVOICE_TERMS);

  if (!hasAccountObject) return false;
  return hasPattern(text, BROAD_OR_DEFERRED_INTENT_PATTERNS);
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

export function detectSelectedOrderPaymentFollowUpIntent(message: string) {
  const text = normalizeForIntent(message);
  if (!text) return false;
  return hasPattern(text, SELECTED_ORDER_PAYMENT_FOLLOW_UP_PATTERNS);
}

export function detectSelectedOrderStatusFollowUpIntent(message: string) {
  const text = normalizeForIntent(message);
  if (!text) return false;
  return hasPattern(text, SELECTED_ORDER_STATUS_FOLLOW_UP_PATTERNS);
}

export function detectSelectedOrderCancelFollowUpIntent(message: string) {
  const text = normalizeForIntent(message);
  if (!text) return false;
  return hasPattern(text, SELECTED_ORDER_CANCEL_FOLLOW_UP_PATTERNS);
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
