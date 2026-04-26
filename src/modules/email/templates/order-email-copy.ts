import { CANCELLATION_WINDOW_HOURS } from "@/constants";
import {
  DEFAULT_APP_LANG,
  normalizeToSupported,
  type AppLang,
} from "@/lib/i18n/app-lang";

type OrderCreatedCustomerCopy = {
  heading: string;
  subject: (tenantLabel: string) => string;
  preview: (tenantLabel: string) => string;
  greeting: (customerName?: string) => string;
  intro: (tenantLabel: string, dateRange?: string | null) => string;
  cancellationNoteOpen: string;
  cancellationNoteClosed: string;
  responsibilityNote: string;
  nextStepsNote: string;
  ctaLabel: string;
  orderLabel: string;
};

type OrderCreatedTenantCopy = {
  heading: string;
  subject: string;
  preview: string;
  greeting: (tenantName?: string) => string;
  intro: (customerName?: string, dateRange?: string | null) => string;
  cancellationNoteOpen: string;
  cancellationNoteClosed: string;
  responsibilityNote: string;
  nextStepsNote: string;
  ctaLabel: string;
  orderLabel: string;
};

type OrderRequestDecisionCustomerCopy = {
  heading: string;
  subject: (tenantLabel: string) => string;
  preview: (tenantLabel: string) => string;
  greeting: (customerName?: string) => string;
  intro: (tenantLabel: string, dateRange?: string | null) => string;
  statusNote: string;
  providerReasonLabel?: string;
  ctaLabel: string;
  orderLabel: string;
};

export type OrderCanceledByRole = "customer" | "tenant";

type OrderCanceledCustomerCopy = {
  heading: string;
  subject: (tenantLabel: string) => string;
  preview: (tenantLabel: string) => string;
  greeting: (customerName?: string) => string;
  introCustomerCanceled: (
    tenantLabel: string,
    dateRange?: string | null,
  ) => string;
  introTenantCanceled: (
    tenantLabel: string,
    dateRange?: string | null,
  ) => string;
  slotsReleasedNote: string;
  ctaLabel: string;
  orderLabel: string;
};

type OrderCanceledTenantCopy = {
  heading: string;
  subject: string;
  preview: string;
  greeting: (tenantName?: string) => string;
  introCustomerCanceled: (
    customerName?: string,
    dateRange?: string | null,
  ) => string;
  introTenantCanceled: (
    customerName?: string,
    dateRange?: string | null,
  ) => string;
  slotsReleasedNote: string;
  ctaLabel: string;
  orderLabel: string;
};

type OrderEmailCopy = {
  createdCustomer: OrderCreatedCustomerCopy;
  createdTenant: OrderCreatedTenantCopy;
};

function resolveOrderEmailLang(locale?: string): AppLang {
  return normalizeToSupported(locale);
}

export function toLocaleTag(language?: string) {
  // Keep email locale tags aligned with the canonical app-lang normalization.
  const normalized = normalizeToSupported(language ?? DEFAULT_APP_LANG);
  switch (normalized) {
    case "de":
      return "de-DE";
    case "fr":
      return "fr-FR";
    case "es":
      return "es-ES";
    case "it":
      return "it-IT";
    case "pt":
      return "pt-PT";
    case "pl":
      return "pl-PL";
    case "ro":
      return "ro-RO";
    case "uk":
      return "uk-UA";
    default:
      return "en-US";
  }
}

// Reuse the same order-email formatting rules across created and canceled templates.
export function formatOrderEmailDateRangeUtc(
  startIso?: string,
  endIso?: string,
  language?: string,
) {
  if (!startIso && !endIso) return null;
  const startMs = Date.parse(startIso ?? "");
  const endMs = Date.parse(endIso ?? startIso ?? "");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;

  const fmt = new Intl.DateTimeFormat(toLocaleTag(language), {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  const startStr = fmt.format(new Date(startMs));
  const endStr = fmt.format(new Date(endMs));
  return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
}

export function formatOrderEmailTenantLabel(
  tenantSlug?: string,
  tenantName?: string,
) {
  const slug = (tenantSlug ?? "").trim();
  const name = (tenantName ?? "").trim();
  if (slug && name) return `${slug} (${name})`;
  return slug || name || "the tenant";
}

export function isWithinOrderCancellationCutoff(
  firstSlotStartIso?: string,
  now = new Date(),
) {
  const startMs = Date.parse(firstSlotStartIso ?? "");
  // Fail closed so malformed dates never imply self-cancellation is still open.
  if (!Number.isFinite(startMs)) return true;
  return (
    startMs <= now.getTime() + CANCELLATION_WINDOW_HOURS * 60 * 60 * 1000
  );
}

// Keep created-order email guidance short: one responsibility note and one next-steps note.
const ORDER_EMAIL_COPY: Record<AppLang, OrderEmailCopy> = {
  en: {
    createdCustomer: {
      heading: "Order received",
      subject: (tenantLabel) => `Order received by ${tenantLabel}`,
      preview: (tenantLabel) => `Order received by ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Dear ${customerName.trim()},` : "Dear,",
      intro: (tenantLabel, dateRange) =>
        `Your order was received by ${tenantLabel}${dateRange ? ` and is scheduled for ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "This order can be canceled up to 24 hours before the first scheduled slot from the Orders page actions menu.",
      cancellationNoteClosed:
        "This order is already inside the 24-hour cutoff and can no longer be canceled from the Orders page actions menu.",
      responsibilityNote:
        "Services are performed by independent providers, not by Infinisimo. Providers remain responsible for the quality, legality, safety, and performance of the services they deliver.",
      nextStepsNote:
        "After the service is completed, the provider confirms completion. You can then accept the service from your Orders page. Once the invoice is issued, you can pay it there as well.",
      ctaLabel: "View Orders",
      orderLabel: "Order",
    },
    createdTenant: {
      heading: "New order scheduled",
      subject: "New order scheduled in your calendar",
      preview: "New order scheduled in your calendar.",
      greeting: (tenantName) =>
        tenantName?.trim() ? `Dear ${tenantName.trim()},` : "Dear,",
      intro: (customerName, dateRange) =>
        `A new order from ${(customerName ?? "a customer").trim() || "a customer"} is scheduled in your calendar${dateRange ? ` (${dateRange})` : ""}.`,
      cancellationNoteOpen:
        "This order can be canceled by either you or the customer up to 24 hours before the first scheduled slot from the Orders actions menu in Dashboard.",
      cancellationNoteClosed:
        "This order is already inside the 24-hour cutoff and can no longer be canceled by you or the customer from the Orders actions menu in Dashboard.",
      responsibilityNote:
        "Infinisimo operates as an intermediary marketplace and provides the platform and payment infrastructure where enabled. Customers remain responsible for paying issued invoices, and providers remain responsible for the services they deliver.",
      nextStepsNote:
        "After the service is completed, confirm completion in Dashboard. Once the customer accepts the service, issue the invoice from the Orders section.",
      ctaLabel: "View Dashboard",
      orderLabel: "Order",
    },
  },
  de: {
    createdCustomer: {
      heading: "Bestellung eingegangen",
      subject: (tenantLabel) => `Bestellung bei ${tenantLabel} eingegangen`,
      preview: (tenantLabel) => `Bestellung bei ${tenantLabel} eingegangen.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Hallo ${customerName.trim()},` : "Hallo,",
      intro: (tenantLabel, dateRange) =>
        `Ihre Bestellung ist bei ${tenantLabel} eingegangen${dateRange ? ` und ist für ${dateRange} geplant` : ""}.`,
      cancellationNoteOpen:
        "Diese Bestellung kann bis 24 Stunden vor dem ersten geplanten Termin über das Aktionsmenü auf der Seite Bestellungen storniert werden.",
      cancellationNoteClosed:
        "Diese Bestellung liegt bereits innerhalb der 24-Stunden-Frist und kann nicht mehr über das Aktionsmenü auf der Seite Bestellungen storniert werden.",
      responsibilityNote:
        "Die Leistungen werden von unabhängigen Anbietern erbracht, nicht von Infinisimo. Die Anbieter bleiben für Qualität, Rechtmäßigkeit, Sicherheit und Ausführung ihrer Leistungen verantwortlich.",
      nextStepsNote:
        "Nach Abschluss der Leistung bestätigt der Anbieter die Durchführung. Anschließend können Sie die Leistung auf Ihrer Bestellseite akzeptieren. Sobald die Rechnung ausgestellt ist, können Sie sie dort auch bezahlen.",
      ctaLabel: "Bestellungen ansehen",
      orderLabel: "Bestellung",
    },
    createdTenant: {
      heading: "Neue Bestellung eingeplant",
      subject: "Neue Bestellung in Ihrem Kalender",
      preview: "Neue Bestellung in Ihrem Kalender.",
      greeting: (tenantName) =>
        tenantName?.trim() ? `Hallo ${tenantName.trim()},` : "Hallo,",
      intro: (customerName, dateRange) =>
        `Eine neue Bestellung von ${(customerName ?? "einem Kunden").trim() || "einem Kunden"} wurde in Ihrem Kalender eingeplant${dateRange ? ` (${dateRange})` : ""}.`,
      cancellationNoteOpen:
        "Diese Bestellung kann bis 24 Stunden vor dem ersten geplanten Termin entweder von Ihnen oder vom Kunden über das Aktionsmenü bei den Aufträgen im Dashboard storniert werden.",
      cancellationNoteClosed:
        "Diese Bestellung liegt bereits innerhalb der 24-Stunden-Frist und kann weder von Ihnen noch vom Kunden über das Aktionsmenü bei den Aufträgen im Dashboard storniert werden.",
      responsibilityNote:
        "Infinisimo betreibt einen Vermittlungsmarktplatz und stellt, sofern aktiviert, die Plattform und Zahlungsinfrastruktur bereit. Kunden bleiben für die Bezahlung ausgestellter Rechnungen verantwortlich, und Anbieter bleiben für die von ihnen erbrachten Leistungen verantwortlich.",
      nextStepsNote:
        "Nach Abschluss der Leistung bestätigen Sie die Durchführung im Dashboard. Sobald der Kunde die Leistung akzeptiert, stellen Sie die Rechnung im Bereich Bestellungen aus.",
      ctaLabel: "Dashboard ansehen",
      orderLabel: "Bestellung",
    },
  },
  es: {
    createdCustomer: {
      heading: "Pedido recibido",
      subject: (tenantLabel) => `Pedido recibido por ${tenantLabel}`,
      preview: (tenantLabel) => `Pedido recibido por ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Hola ${customerName.trim()},` : "Hola,",
      intro: (tenantLabel, dateRange) =>
        `Tu pedido ha sido recibido por ${tenantLabel}${dateRange ? ` y está programado para ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Este pedido puede cancelarse hasta 24 horas antes del primer turno programado desde el menú de acciones de la página de pedidos.",
      cancellationNoteClosed:
        "Este pedido ya está dentro del límite de 24 horas y ya no puede cancelarse desde el menú de acciones de la página de pedidos.",
      responsibilityNote:
        "Los servicios son realizados por proveedores independientes, no por Infinisimo. Los proveedores siguen siendo responsables de la calidad, legalidad, seguridad y ejecución de los servicios que prestan.",
      nextStepsNote:
        "Una vez completado el servicio, el proveedor confirma su finalización. Después puedes aceptar el servicio desde tu página de pedidos. Cuando se emita la factura, también podrás pagarla allí.",
      ctaLabel: "Ver pedidos",
      orderLabel: "Pedido",
    },
    createdTenant: {
      heading: "Nuevo pedido programado",
      subject: "Nuevo pedido programado en tu calendario",
      preview: "Nuevo pedido programado en tu calendario.",
      greeting: (tenantName) =>
        tenantName?.trim() ? `Hola ${tenantName.trim()},` : "Hola,",
      intro: (customerName, dateRange) =>
        `Un nuevo pedido de ${(customerName ?? "un cliente").trim() || "un cliente"} está programado en tu calendario${dateRange ? ` (${dateRange})` : ""}.`,
      cancellationNoteOpen:
        "Este pedido puede cancelarse hasta 24 horas antes del primer turno programado por ti o por el cliente desde el menú de acciones de Pedidos en el Panel.",
      cancellationNoteClosed:
        "Este pedido ya está dentro del límite de 24 horas y ya no puede cancelarse ni por ti ni por el cliente desde el menú de acciones de Pedidos en el Panel.",
      responsibilityNote:
        "Infinisimo opera como marketplace intermediario y proporciona la plataforma y la infraestructura de pago cuando están habilitadas. Los clientes siguen siendo responsables de pagar las facturas emitidas y los proveedores siguen siendo responsables de los servicios que prestan.",
      nextStepsNote:
        "Una vez completado el servicio, confirma la finalización en el Panel. Cuando el cliente acepte el servicio, emite la factura en la sección Pedidos.",
      ctaLabel: "Ver panel",
      orderLabel: "Pedido",
    },
  },
  fr: {
    createdCustomer: {
      heading: "Commande reçue",
      subject: (tenantLabel) => `Commande reçue par ${tenantLabel}`,
      preview: (tenantLabel) => `Commande reçue par ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Bonjour ${customerName.trim()},` : "Bonjour,",
      intro: (tenantLabel, dateRange) =>
        `Votre commande a été reçue par ${tenantLabel}${dateRange ? ` et est prévue pour ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Cette commande peut être annulée jusqu’à 24 heures avant le premier créneau prévu depuis le menu d’actions de la page Commandes.",
      cancellationNoteClosed:
        "Cette commande est déjà dans la période de moins de 24 heures et ne peut plus être annulée depuis le menu d’actions de la page Commandes.",
      responsibilityNote:
        "Les services sont fournis par des prestataires indépendants, et non par Infinisimo. Les prestataires restent responsables de la qualité, de la légalité, de la sécurité et de l’exécution des services qu’ils fournissent.",
      nextStepsNote:
        "Une fois le service terminé, le prestataire confirme son exécution. Vous pouvez ensuite accepter le service depuis votre page Commandes. Une fois la facture émise, vous pourrez aussi la payer au même endroit.",
      ctaLabel: "Voir les commandes",
      orderLabel: "Commande",
    },
    createdTenant: {
      heading: "Nouvelle commande planifiée",
      subject: "Nouvelle commande planifiée dans votre calendrier",
      preview: "Nouvelle commande planifiée dans votre calendrier.",
      greeting: (tenantName) =>
        tenantName?.trim() ? `Bonjour ${tenantName.trim()},` : "Bonjour,",
      intro: (customerName, dateRange) =>
        `Une nouvelle commande de ${(customerName ?? "un client").trim() || "un client"} est planifiée dans votre calendrier${dateRange ? ` (${dateRange})` : ""}.`,
      cancellationNoteOpen:
        "Cette commande peut être annulée jusqu’à 24 heures avant le premier créneau prévu par vous ou par le client depuis le menu d’actions de la section Commandes du Dashboard.",
      cancellationNoteClosed:
        "Cette commande est déjà dans la période de moins de 24 heures et ne peut plus être annulée ni par vous ni par le client depuis le menu d’actions de la section Commandes du Dashboard.",
      responsibilityNote:
        "Infinisimo agit comme une marketplace intermédiaire et fournit la plateforme et l’infrastructure de paiement lorsqu’elles sont activées. Les clients restent responsables du paiement des factures émises, et les prestataires restent responsables des services qu’ils fournissent.",
      nextStepsNote:
        "Une fois le service terminé, confirmez l’exécution dans le Dashboard. Lorsque le client accepte le service, émettez la facture depuis la section Commandes.",
      ctaLabel: "Ouvrir Dashboard",
      orderLabel: "Commande",
    },
  },
  it: {
    createdCustomer: {
      heading: "Ordine ricevuto",
      subject: (tenantLabel) => `Ordine ricevuto da ${tenantLabel}`,
      preview: (tenantLabel) => `Ordine ricevuto da ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Ciao ${customerName.trim()},` : "Ciao,",
      intro: (tenantLabel, dateRange) =>
        `Il tuo ordine è stato ricevuto da ${tenantLabel}${dateRange ? ` ed è programmato per ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Questo ordine può essere annullato fino a 24 ore prima del primo slot programmato dal menu azioni della pagina Ordini.",
      cancellationNoteClosed:
        "Questo ordine è già entro il limite delle 24 ore e non può più essere annullato dal menu azioni della pagina Ordini.",
      responsibilityNote:
        "I servizi sono svolti da fornitori indipendenti, non da Infinisimo. I fornitori restano responsabili della qualità, legalità, sicurezza ed esecuzione dei servizi che prestano.",
      nextStepsNote:
        "Dopo il completamento del servizio, il fornitore ne conferma l’esecuzione. Potrai quindi accettare il servizio dalla tua pagina Ordini. Una volta emessa la fattura, potrai pagarla lì.",
      ctaLabel: "Vedi ordini",
      orderLabel: "Ordine",
    },
    createdTenant: {
      heading: "Nuovo ordine programmato",
      subject: "Nuovo ordine programmato nel tuo calendario",
      preview: "Nuovo ordine programmato nel tuo calendario.",
      greeting: (tenantName) =>
        tenantName?.trim() ? `Ciao ${tenantName.trim()},` : "Ciao,",
      intro: (customerName, dateRange) =>
        `Un nuovo ordine da ${(customerName ?? "un cliente").trim() || "un cliente"} è programmato nel tuo calendario${dateRange ? ` (${dateRange})` : ""}.`,
      cancellationNoteOpen:
        "Questo ordine può essere annullato fino a 24 ore prima del primo slot programmato da te o dal cliente dal menu azioni Ordini nella Dashboard.",
      cancellationNoteClosed:
        "Questo ordine è già entro il limite delle 24 ore e non può più essere annullato né da te né dal cliente dal menu azioni Ordini nella Dashboard.",
      responsibilityNote:
        "Infinisimo opera come marketplace intermediario e fornisce la piattaforma e l’infrastruttura di pagamento dove abilitate. I clienti restano responsabili del pagamento delle fatture emesse e i fornitori restano responsabili dei servizi che prestano.",
      nextStepsNote:
        "Dopo il completamento del servizio, conferma l’esecuzione nella Dashboard. Quando il cliente accetta il servizio, emetti la fattura nella sezione Ordini.",
      ctaLabel: "Vedi Dashboard",
      orderLabel: "Ordine",
    },
  },
  pl: {
    createdCustomer: {
      heading: "Zamówienie otrzymane",
      subject: (tenantLabel) =>
        `Zamówienie zostało przyjęte przez ${tenantLabel}`,
      preview: (tenantLabel) =>
        `Zamówienie zostało przyjęte przez ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Cześć ${customerName.trim()},` : "Cześć,",
      intro: (tenantLabel, dateRange) =>
        `Twoje zamówienie zostało przyjęte przez ${tenantLabel}${dateRange ? ` i jest zaplanowane na ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "To zamówienie można anulować do 24 godzin przed pierwszym zaplanowanym terminem z menu akcji na stronie zamówień.",
      cancellationNoteClosed:
        "To zamówienie jest już w okresie krótszym niż 24 godziny i nie można go już anulować z menu akcji na stronie zamówień.",
      responsibilityNote:
        "Usługi są świadczone przez niezależnych usługodawców, a nie przez Infinisimo. Usługodawcy pozostają odpowiedzialni za jakość, legalność, bezpieczeństwo i wykonanie świadczonych usług.",
      nextStepsNote:
        "Po wykonaniu usługi usługodawca potwierdza jej realizację. Następnie możesz zaakceptować usługę na stronie zamówień. Gdy faktura zostanie wystawiona, będzie można ją tam również opłacić.",
      ctaLabel: "Zobacz zamówienia",
      orderLabel: "Zamówienie",
    },
    createdTenant: {
      heading: "Nowe zamówienie w kalendarzu",
      subject: "Nowe zamówienie zaplanowane w Twoim kalendarzu",
      preview: "Nowe zamówienie zaplanowane w Twoim kalendarzu.",
      greeting: (tenantName) =>
        tenantName?.trim() ? `Cześć ${tenantName.trim()},` : "Cześć,",
      intro: (customerName, dateRange) =>
        `Nowe zamówienie od ${(customerName ?? "klienta").trim() || "klienta"} zostało zaplanowane w Twoim kalendarzu${dateRange ? ` (${dateRange})` : ""}.`,
      cancellationNoteOpen:
        "To zamówienie można anulować do 24 godzin przed pierwszym zaplanowanym terminem przez Ciebie lub przez klienta z menu akcji Zamówienia w Panelu.",
      cancellationNoteClosed:
        "To zamówienie jest już w okresie krótszym niż 24 godziny i nie można go już anulować ani przez Ciebie, ani przez klienta z menu akcji Zamówienia w Panelu.",
      responsibilityNote:
        "Infinisimo działa jako pośredniczący marketplace i zapewnia platformę oraz infrastrukturę płatniczą tam, gdzie są dostępne. Klienci pozostają odpowiedzialni za opłacenie wystawionych faktur, a usługodawcy pozostają odpowiedzialni za świadczone usługi.",
      nextStepsNote:
        "Po wykonaniu usługi potwierdź jej realizację w Panelu. Gdy klient zaakceptuje usługę, wystaw fakturę w sekcji zamówień.",
      ctaLabel: "Zobacz panel",
      orderLabel: "Zamówienie",
    },
  },
  pt: {
    createdCustomer: {
      heading: "Encomenda recebida",
      subject: (tenantLabel) => `Encomenda recebida por ${tenantLabel}`,
      preview: (tenantLabel) => `Encomenda recebida por ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Olá ${customerName.trim()},` : "Olá,",
      intro: (tenantLabel, dateRange) =>
        `A sua encomenda foi recebida por ${tenantLabel}${dateRange ? ` e está agendada para ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Esta encomenda pode ser cancelada até 24 horas antes do primeiro horário agendado no menu de ações da página de encomendas.",
      cancellationNoteClosed:
        "Esta encomenda já está dentro do limite de 24 horas e já não pode ser cancelada no menu de ações da página de encomendas.",
      responsibilityNote:
        "Os serviços são prestados por fornecedores independentes, e não pela Infinisimo. Os fornecedores continuam responsáveis pela qualidade, legalidade, segurança e execução dos serviços que prestam.",
      nextStepsNote:
        "Depois de o serviço ser concluído, o fornecedor confirma a conclusão. Depois pode aceitar o serviço na sua página de encomendas. Quando a fatura for emitida, também a poderá pagar aí.",
      ctaLabel: "Ver encomendas",
      orderLabel: "Encomenda",
    },
    createdTenant: {
      heading: "Nova encomenda agendada",
      subject: "Nova encomenda agendada no seu calendário",
      preview: "Nova encomenda agendada no seu calendário.",
      greeting: (tenantName) =>
        tenantName?.trim() ? `Olá ${tenantName.trim()},` : "Olá,",
      intro: (customerName, dateRange) =>
        `Uma nova encomenda de ${(customerName ?? "um cliente").trim() || "um cliente"} está agendada no seu calendário${dateRange ? ` (${dateRange})` : ""}.`,
      cancellationNoteOpen:
        "Esta encomenda pode ser cancelada até 24 horas antes do primeiro horário agendado por si ou pelo cliente no menu de ações Encomendas no Painel.",
      cancellationNoteClosed:
        "Esta encomenda já está dentro do limite de 24 horas e já não pode ser cancelada nem por si nem pelo cliente no menu de ações Encomendas no Painel.",
      responsibilityNote:
        "A Infinisimo opera como marketplace intermediário e fornece a plataforma e a infraestrutura de pagamento quando disponíveis. Os clientes continuam responsáveis pelo pagamento das faturas emitidas e os fornecedores continuam responsáveis pelos serviços que prestam.",
      nextStepsNote:
        "Depois de o serviço ser concluído, confirme a conclusão no Painel. Quando o cliente aceitar o serviço, emita a fatura na área de encomendas.",
      ctaLabel: "Ver painel",
      orderLabel: "Encomenda",
    },
  },
  ro: {
    createdCustomer: {
      heading: "Comandă primită",
      subject: (tenantLabel) => `Comandă primită de ${tenantLabel}`,
      preview: (tenantLabel) => `Comandă primită de ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Bună ${customerName.trim()},` : "Bună,",
      intro: (tenantLabel, dateRange) =>
        `Comanda ta a fost primită de ${tenantLabel}${dateRange ? ` și este programată pentru ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Această comandă poate fi anulată cu până la 24 de ore înainte de primul interval programat din meniul de acțiuni al paginii de comenzi.",
      cancellationNoteClosed:
        "Această comandă este deja în interiorul limitei de 24 de ore și nu mai poate fi anulată din meniul de acțiuni al paginii de comenzi.",
      responsibilityNote:
        "Serviciile sunt prestate de furnizori independenți, nu de Infinisimo. Furnizorii rămân responsabili pentru calitatea, legalitatea, siguranța și executarea serviciilor pe care le prestează.",
      nextStepsNote:
        "După finalizarea serviciului, furnizorul confirmă finalizarea. Apoi puteți accepta serviciul din pagina dvs. de comenzi. Odată ce factura este emisă, o puteți plăti tot de acolo.",
      ctaLabel: "Vezi comenzile",
      orderLabel: "Comandă",
    },
    createdTenant: {
      heading: "Comandă nouă programată",
      subject: "Comandă nouă programată în calendarul tău",
      preview: "Comandă nouă programată în calendarul tău.",
      greeting: (tenantName) =>
        tenantName?.trim() ? `Bună ${tenantName.trim()},` : "Bună,",
      intro: (customerName, dateRange) =>
        `O comandă nouă de la ${(customerName ?? "un client").trim() || "un client"} este programată în calendarul tău${dateRange ? ` (${dateRange})` : ""}.`,
      cancellationNoteOpen:
        "Această comandă poate fi anulată cu până la 24 de ore înainte de primul interval programat de tine sau de client din meniul de acțiuni Comenzi din Panou.",
      cancellationNoteClosed:
        "Această comandă este deja în interiorul limitei de 24 de ore și nu mai poate fi anulată nici de tine, nici de client din meniul de acțiuni Comenzi din Panou.",
      responsibilityNote:
        "Infinisimo operează ca marketplace intermediar și furnizează platforma și infrastructura de plată acolo unde sunt disponibile. Clienții rămân responsabili pentru plata facturilor emise, iar furnizorii rămân responsabili pentru serviciile pe care le prestează.",
      nextStepsNote:
        "După finalizarea serviciului, confirmați finalizarea în Panou. Când clientul acceptă serviciul, emiteți factura din secțiunea de comenzi.",
      ctaLabel: "Vezi panoul",
      orderLabel: "Comandă",
    },
  },
  uk: {
    createdCustomer: {
      heading: "Замовлення отримано",
      subject: (tenantLabel) =>
        `Замовлення отримано постачальником ${tenantLabel}`,
      preview: (tenantLabel) =>
        `Замовлення отримано постачальником ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim()
          ? `Вітаємо, ${customerName.trim()}!`
          : "Вітаємо!",
      intro: (tenantLabel, dateRange) =>
        `Ваше замовлення отримано постачальником ${tenantLabel}${dateRange ? ` і заплановано на ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Це замовлення можна скасувати не пізніше ніж за 24 години до першого запланованого слота через меню дій на сторінці замовлень.",
      cancellationNoteClosed:
        "Це замовлення вже в межах 24-годинного обмеження, тому його більше не можна скасувати через меню дій на сторінці замовлень.",
      responsibilityNote:
        "Послуги надаються незалежними постачальниками, а не Infinisimo. Постачальники залишаються відповідальними за якість, законність, безпеку та виконання послуг, які вони надають.",
      nextStepsNote:
        "Після завершення послуги постачальник підтверджує її виконання. Після цього Ви можете прийняти послугу на сторінці Ваших замовлень. Коли рахунок буде виставлено, Ви зможете оплатити його там само.",
      ctaLabel: "Переглянути замовлення",
      orderLabel: "Замовлення",
    },
    createdTenant: {
      heading: "Нове замовлення заплановано",
      subject: "Нове замовлення у вашому календарі",
      preview: "Нове замовлення у вашому календарі.",
      greeting: (tenantName) =>
        tenantName?.trim()
          ? `Вітаємо, ${tenantName.trim()}!`
          : "Вітаємо!",
      intro: (customerName, dateRange) =>
        `Нове замовлення від ${(customerName ?? "клієнта").trim() || "клієнта"} заплановано у вашому календарі${dateRange ? ` (${dateRange})` : ""}.`,
      cancellationNoteOpen:
        "Це замовлення можна скасувати не пізніше ніж за 24 години до першого запланованого слота Вами або клієнтом через меню дій у розділі «Замовлення» в панелі.",
      cancellationNoteClosed:
        "Це замовлення вже в межах 24-годинного обмеження, тому його більше не можна скасувати ні Вами, ні клієнтом через меню дій у розділі «Замовлення» в панелі.",
      responsibilityNote:
        "Infinisimo працює як посередницький маркетплейс і надає платформу та платіжну інфраструктуру там, де це доступно. Клієнти залишаються відповідальними за оплату виставлених рахунків, а постачальники залишаються відповідальними за послуги, які вони надають.",
      nextStepsNote:
        "Після завершення послуги підтвердьте її виконання в панелі. Коли клієнт прийме послугу, виставте рахунок у розділі «Замовлення».",
      ctaLabel: "Переглянути панель",
      orderLabel: "Замовлення",
    },
  },
};

const ORDER_REQUEST_EMAIL_COPY: Record<
  AppLang,
  {
    createdCustomer: Partial<OrderCreatedCustomerCopy>;
    createdTenant: Partial<OrderCreatedTenantCopy>;
    confirmedCustomer: OrderRequestDecisionCustomerCopy;
    declinedCustomer: OrderRequestDecisionCustomerCopy;
  }
> = {
  en: {
    createdCustomer: {
      heading: "Booking request sent",
      subject: (tenantLabel) => `Booking request sent to ${tenantLabel}`,
      preview: (tenantLabel) =>
        `Your booking request was sent to ${tenantLabel}.`,
      intro: (tenantLabel, dateRange) =>
        `Your booking request was sent to ${tenantLabel}${dateRange ? ` for ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "The provider still needs to confirm before this booking is scheduled.",
      cancellationNoteClosed:
        "The provider still needs to confirm before this booking is scheduled.",
      nextStepsNote:
        "You will receive an update after the provider confirms or declines the request.",
    },
    createdTenant: {
      heading: "New booking request",
      subject: "New booking request awaiting confirmation",
      preview: "A customer sent a booking request.",
      intro: (customerName, dateRange) =>
        `${(customerName ?? "A customer").trim() || "A customer"} sent a booking request${dateRange ? ` for ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Please confirm or decline this request from your dashboard.",
      cancellationNoteClosed:
        "Please confirm or decline this request from your dashboard.",
      nextStepsNote:
        "Only confirm the request if you can provide the service at the requested time.",
    },
    confirmedCustomer: {
      heading: "Booking request confirmed",
      subject: (tenantLabel) => `Booking confirmed by ${tenantLabel}`,
      preview: (tenantLabel) => `${tenantLabel} confirmed your booking request.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Dear ${customerName.trim()},` : "Dear,",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} confirmed your booking request${dateRange ? ` for ${dateRange}` : ""}. The booking is now scheduled.`,
      statusNote:
        "You can view the scheduled booking from your Orders page.",
      ctaLabel: "View Orders",
      orderLabel: "Order",
    },
    declinedCustomer: {
      heading: "Booking request declined",
      subject: (tenantLabel) => `Booking request declined by ${tenantLabel}`,
      preview: (tenantLabel) => `${tenantLabel} declined your booking request.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Dear ${customerName.trim()},` : "Dear,",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} declined your booking request${dateRange ? ` for ${dateRange}` : ""}.`,
      statusNote:
        "The requested slots have been released and are no longer reserved for this order.",
      providerReasonLabel: "Provider note",
      ctaLabel: "View Orders",
      orderLabel: "Order",
    },
  },
  de: {
    createdCustomer: {
      heading: "Buchungsanfrage gesendet",
      subject: (tenantLabel) => `Buchungsanfrage an ${tenantLabel} gesendet`,
      preview: (tenantLabel) =>
        `Ihre Buchungsanfrage wurde an ${tenantLabel} gesendet.`,
      intro: (tenantLabel, dateRange) =>
        `Ihre Buchungsanfrage wurde an ${tenantLabel} gesendet${dateRange ? ` für ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Der Anbieter muss die Anfrage noch bestätigen, bevor die Buchung geplant ist.",
      cancellationNoteClosed:
        "Der Anbieter muss die Anfrage noch bestätigen, bevor die Buchung geplant ist.",
      nextStepsNote:
        "Sie erhalten eine Aktualisierung, nachdem der Anbieter die Anfrage bestätigt oder ablehnt.",
    },
    createdTenant: {
      heading: "Neue Buchungsanfrage",
      subject: "Neue Buchungsanfrage wartet auf Bestätigung",
      preview: "Ein Kunde hat eine Buchungsanfrage gesendet.",
      intro: (customerName, dateRange) =>
        `${(customerName ?? "Ein Kunde").trim() || "Ein Kunde"} hat eine Buchungsanfrage gesendet${dateRange ? ` für ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Bitte bestätigen oder lehnen Sie diese Anfrage in Ihrem Dashboard ab.",
      cancellationNoteClosed:
        "Bitte bestätigen oder lehnen Sie diese Anfrage in Ihrem Dashboard ab.",
      nextStepsNote:
        "Bestätigen Sie die Anfrage nur, wenn Sie die Leistung zum angefragten Zeitpunkt erbringen können.",
    },
    confirmedCustomer: {
      heading: "Buchungsanfrage bestätigt",
      subject: (tenantLabel) => `Buchung von ${tenantLabel} bestätigt`,
      preview: (tenantLabel) =>
        `${tenantLabel} hat Ihre Buchungsanfrage bestätigt.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Hallo ${customerName.trim()},` : "Hallo,",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} hat Ihre Buchungsanfrage${dateRange ? ` für ${dateRange}` : ""} bestätigt. Die Buchung ist jetzt geplant.`,
      statusNote:
        "Sie können die geplante Buchung auf Ihrer Bestellseite ansehen.",
      ctaLabel: "Bestellungen ansehen",
      orderLabel: "Bestellung",
    },
    declinedCustomer: {
      heading: "Buchungsanfrage abgelehnt",
      subject: (tenantLabel) => `Buchungsanfrage von ${tenantLabel} abgelehnt`,
      preview: (tenantLabel) =>
        `${tenantLabel} hat Ihre Buchungsanfrage abgelehnt.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Hallo ${customerName.trim()},` : "Hallo,",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} hat Ihre Buchungsanfrage${dateRange ? ` für ${dateRange}` : ""} abgelehnt.`,
      statusNote:
        "Die angefragten Zeitfenster wurden freigegeben und sind für diese Bestellung nicht mehr reserviert.",
      providerReasonLabel: "Hinweis des Anbieters",
      ctaLabel: "Bestellungen ansehen",
      orderLabel: "Bestellung",
    },
  },
  es: {
    createdCustomer: {
      heading: "Solicitud de reserva enviada",
      subject: (tenantLabel) => `Solicitud de reserva enviada a ${tenantLabel}`,
      preview: (tenantLabel) =>
        `Tu solicitud de reserva se envió a ${tenantLabel}.`,
      intro: (tenantLabel, dateRange) =>
        `Tu solicitud de reserva se envió a ${tenantLabel}${dateRange ? ` para ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "El proveedor todavía debe confirmar antes de que la reserva quede programada.",
      cancellationNoteClosed:
        "El proveedor todavía debe confirmar antes de que la reserva quede programada.",
      nextStepsNote:
        "Recibirás una actualización cuando el proveedor confirme o rechace la solicitud.",
    },
    createdTenant: {
      heading: "Nueva solicitud de reserva",
      subject: "Nueva solicitud de reserva pendiente de confirmación",
      preview: "Un cliente envió una solicitud de reserva.",
      intro: (customerName, dateRange) =>
        `${(customerName ?? "Un cliente").trim() || "Un cliente"} envió una solicitud de reserva${dateRange ? ` para ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Confirma o rechaza esta solicitud desde tu panel.",
      cancellationNoteClosed:
        "Confirma o rechaza esta solicitud desde tu panel.",
      nextStepsNote:
        "Confirma la solicitud solo si puedes prestar el servicio en el horario solicitado.",
    },
    confirmedCustomer: {
      heading: "Solicitud de reserva confirmada",
      subject: (tenantLabel) => `Reserva confirmada por ${tenantLabel}`,
      preview: (tenantLabel) =>
        `${tenantLabel} confirmó tu solicitud de reserva.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Hola ${customerName.trim()},` : "Hola,",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} confirmó tu solicitud de reserva${dateRange ? ` para ${dateRange}` : ""}. La reserva ya está programada.`,
      statusNote: "Puedes ver la reserva programada desde tu página de pedidos.",
      ctaLabel: "Ver pedidos",
      orderLabel: "Pedido",
    },
    declinedCustomer: {
      heading: "Solicitud de reserva rechazada",
      subject: (tenantLabel) =>
        `Solicitud de reserva rechazada por ${tenantLabel}`,
      preview: (tenantLabel) =>
        `${tenantLabel} rechazó tu solicitud de reserva.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Hola ${customerName.trim()},` : "Hola,",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} rechazó tu solicitud de reserva${dateRange ? ` para ${dateRange}` : ""}.`,
      statusNote:
        "Los horarios solicitados se han liberado y ya no están reservados para este pedido.",
      providerReasonLabel: "Nota del proveedor",
      ctaLabel: "Ver pedidos",
      orderLabel: "Pedido",
    },
  },
  fr: {
    createdCustomer: {
      heading: "Demande de réservation envoyée",
      subject: (tenantLabel) =>
        `Demande de réservation envoyée à ${tenantLabel}`,
      preview: (tenantLabel) =>
        `Votre demande de réservation a été envoyée à ${tenantLabel}.`,
      intro: (tenantLabel, dateRange) =>
        `Votre demande de réservation a été envoyée à ${tenantLabel}${dateRange ? ` pour ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Le prestataire doit encore confirmer avant que la réservation soit planifiée.",
      cancellationNoteClosed:
        "Le prestataire doit encore confirmer avant que la réservation soit planifiée.",
      nextStepsNote:
        "Vous recevrez une mise à jour lorsque le prestataire confirmera ou refusera la demande.",
    },
    createdTenant: {
      heading: "Nouvelle demande de réservation",
      subject: "Nouvelle demande de réservation à confirmer",
      preview: "Un client a envoyé une demande de réservation.",
      intro: (customerName, dateRange) =>
        `${(customerName ?? "Un client").trim() || "Un client"} a envoyé une demande de réservation${dateRange ? ` pour ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Veuillez confirmer ou refuser cette demande depuis votre Dashboard.",
      cancellationNoteClosed:
        "Veuillez confirmer ou refuser cette demande depuis votre Dashboard.",
      nextStepsNote:
        "Confirmez la demande uniquement si vous pouvez fournir le service au créneau demandé.",
    },
    confirmedCustomer: {
      heading: "Demande de réservation confirmée",
      subject: (tenantLabel) => `Réservation confirmée par ${tenantLabel}`,
      preview: (tenantLabel) =>
        `${tenantLabel} a confirmé votre demande de réservation.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Bonjour ${customerName.trim()},` : "Bonjour,",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} a confirmé votre demande de réservation${dateRange ? ` pour ${dateRange}` : ""}. La réservation est maintenant planifiée.`,
      statusNote:
        "Vous pouvez consulter la réservation planifiée depuis votre page Commandes.",
      ctaLabel: "Voir les commandes",
      orderLabel: "Commande",
    },
    declinedCustomer: {
      heading: "Demande de réservation refusée",
      subject: (tenantLabel) =>
        `Demande de réservation refusée par ${tenantLabel}`,
      preview: (tenantLabel) =>
        `${tenantLabel} a refusé votre demande de réservation.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Bonjour ${customerName.trim()},` : "Bonjour,",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} a refusé votre demande de réservation${dateRange ? ` pour ${dateRange}` : ""}.`,
      statusNote:
        "Les créneaux demandés ont été libérés et ne sont plus réservés pour cette commande.",
      providerReasonLabel: "Note du prestataire",
      ctaLabel: "Voir les commandes",
      orderLabel: "Commande",
    },
  },
  it: {
    createdCustomer: {
      heading: "Richiesta di prenotazione inviata",
      subject: (tenantLabel) =>
        `Richiesta di prenotazione inviata a ${tenantLabel}`,
      preview: (tenantLabel) =>
        `La tua richiesta di prenotazione è stata inviata a ${tenantLabel}.`,
      intro: (tenantLabel, dateRange) =>
        `La tua richiesta di prenotazione è stata inviata a ${tenantLabel}${dateRange ? ` per ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Il fornitore deve ancora confermare prima che la prenotazione sia programmata.",
      cancellationNoteClosed:
        "Il fornitore deve ancora confermare prima che la prenotazione sia programmata.",
      nextStepsNote:
        "Riceverai un aggiornamento quando il fornitore confermerà o rifiuterà la richiesta.",
    },
    createdTenant: {
      heading: "Nuova richiesta di prenotazione",
      subject: "Nuova richiesta di prenotazione in attesa di conferma",
      preview: "Un cliente ha inviato una richiesta di prenotazione.",
      intro: (customerName, dateRange) =>
        `${(customerName ?? "Un cliente").trim() || "Un cliente"} ha inviato una richiesta di prenotazione${dateRange ? ` per ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Conferma o rifiuta questa richiesta dalla Dashboard.",
      cancellationNoteClosed:
        "Conferma o rifiuta questa richiesta dalla Dashboard.",
      nextStepsNote:
        "Conferma la richiesta solo se puoi fornire il servizio nell'orario richiesto.",
    },
    confirmedCustomer: {
      heading: "Richiesta di prenotazione confermata",
      subject: (tenantLabel) => `Prenotazione confermata da ${tenantLabel}`,
      preview: (tenantLabel) =>
        `${tenantLabel} ha confermato la tua richiesta di prenotazione.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Ciao ${customerName.trim()},` : "Ciao,",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} ha confermato la tua richiesta di prenotazione${dateRange ? ` per ${dateRange}` : ""}. La prenotazione è ora programmata.`,
      statusNote:
        "Puoi vedere la prenotazione programmata dalla tua pagina Ordini.",
      ctaLabel: "Vedi ordini",
      orderLabel: "Ordine",
    },
    declinedCustomer: {
      heading: "Richiesta di prenotazione rifiutata",
      subject: (tenantLabel) =>
        `Richiesta di prenotazione rifiutata da ${tenantLabel}`,
      preview: (tenantLabel) =>
        `${tenantLabel} ha rifiutato la tua richiesta di prenotazione.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Ciao ${customerName.trim()},` : "Ciao,",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} ha rifiutato la tua richiesta di prenotazione${dateRange ? ` per ${dateRange}` : ""}.`,
      statusNote:
        "Gli slot richiesti sono stati rilasciati e non sono più riservati per questo ordine.",
      providerReasonLabel: "Nota del fornitore",
      ctaLabel: "Vedi ordini",
      orderLabel: "Ordine",
    },
  },
  pl: {
    createdCustomer: {
      heading: "Wysłano prośbę o rezerwację",
      subject: (tenantLabel) =>
        `Prośba o rezerwację wysłana do ${tenantLabel}`,
      preview: (tenantLabel) =>
        `Twoja prośba o rezerwację została wysłana do ${tenantLabel}.`,
      intro: (tenantLabel, dateRange) =>
        `Twoja prośba o rezerwację została wysłana do ${tenantLabel}${dateRange ? ` na ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Usługodawca musi ją jeszcze potwierdzić, zanim rezerwacja zostanie zaplanowana.",
      cancellationNoteClosed:
        "Usługodawca musi ją jeszcze potwierdzić, zanim rezerwacja zostanie zaplanowana.",
      nextStepsNote:
        "Otrzymasz aktualizację, gdy usługodawca potwierdzi lub odrzuci prośbę.",
    },
    createdTenant: {
      heading: "Nowa prośba o rezerwację",
      subject: "Nowa prośba o rezerwację oczekuje na potwierdzenie",
      preview: "Klient wysłał prośbę o rezerwację.",
      intro: (customerName, dateRange) =>
        `${(customerName ?? "Klient").trim() || "Klient"} wysłał prośbę o rezerwację${dateRange ? ` na ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Potwierdź lub odrzuć tę prośbę w panelu.",
      cancellationNoteClosed:
        "Potwierdź lub odrzuć tę prośbę w panelu.",
      nextStepsNote:
        "Potwierdź prośbę tylko wtedy, gdy możesz wykonać usługę w wybranym terminie.",
    },
    confirmedCustomer: {
      heading: "Prośba o rezerwację potwierdzona",
      subject: (tenantLabel) =>
        `Rezerwacja potwierdzona przez ${tenantLabel}`,
      preview: (tenantLabel) =>
        `${tenantLabel} potwierdził Twoją prośbę o rezerwację.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Cześć ${customerName.trim()},` : "Cześć,",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} potwierdził Twoją prośbę o rezerwację${dateRange ? ` na ${dateRange}` : ""}. Rezerwacja jest teraz zaplanowana.`,
      statusNote:
        "Zaplanowaną rezerwację możesz zobaczyć na stronie zamówień.",
      ctaLabel: "Zobacz zamówienia",
      orderLabel: "Zamówienie",
    },
    declinedCustomer: {
      heading: "Prośba o rezerwację odrzucona",
      subject: (tenantLabel) =>
        `Prośba o rezerwację odrzucona przez ${tenantLabel}`,
      preview: (tenantLabel) =>
        `${tenantLabel} odrzucił Twoją prośbę o rezerwację.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Cześć ${customerName.trim()},` : "Cześć,",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} odrzucił Twoją prośbę o rezerwację${dateRange ? ` na ${dateRange}` : ""}.`,
      statusNote:
        "Wybrane terminy zostały zwolnione i nie są już zarezerwowane dla tego zamówienia.",
      providerReasonLabel: "Notatka usługodawcy",
      ctaLabel: "Zobacz zamówienia",
      orderLabel: "Zamówienie",
    },
  },
  pt: {
    createdCustomer: {
      heading: "Pedido de reserva enviado",
      subject: (tenantLabel) => `Pedido de reserva enviado para ${tenantLabel}`,
      preview: (tenantLabel) =>
        `O seu pedido de reserva foi enviado para ${tenantLabel}.`,
      intro: (tenantLabel, dateRange) =>
        `O seu pedido de reserva foi enviado para ${tenantLabel}${dateRange ? ` para ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "O fornecedor ainda precisa de confirmar antes de a reserva ficar agendada.",
      cancellationNoteClosed:
        "O fornecedor ainda precisa de confirmar antes de a reserva ficar agendada.",
      nextStepsNote:
        "Receberá uma atualização quando o fornecedor confirmar ou recusar o pedido.",
    },
    createdTenant: {
      heading: "Novo pedido de reserva",
      subject: "Novo pedido de reserva a aguardar confirmação",
      preview: "Um cliente enviou um pedido de reserva.",
      intro: (customerName, dateRange) =>
        `${(customerName ?? "Um cliente").trim() || "Um cliente"} enviou um pedido de reserva${dateRange ? ` para ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Confirme ou recuse este pedido no painel.",
      cancellationNoteClosed:
        "Confirme ou recuse este pedido no painel.",
      nextStepsNote:
        "Confirme o pedido apenas se puder prestar o serviço no horário solicitado.",
    },
    confirmedCustomer: {
      heading: "Pedido de reserva confirmado",
      subject: (tenantLabel) => `Reserva confirmada por ${tenantLabel}`,
      preview: (tenantLabel) =>
        `${tenantLabel} confirmou o seu pedido de reserva.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Olá ${customerName.trim()},` : "Olá,",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} confirmou o seu pedido de reserva${dateRange ? ` para ${dateRange}` : ""}. A reserva está agora agendada.`,
      statusNote:
        "Pode ver a reserva agendada na sua página de encomendas.",
      ctaLabel: "Ver encomendas",
      orderLabel: "Encomenda",
    },
    declinedCustomer: {
      heading: "Pedido de reserva recusado",
      subject: (tenantLabel) =>
        `Pedido de reserva recusado por ${tenantLabel}`,
      preview: (tenantLabel) =>
        `${tenantLabel} recusou o seu pedido de reserva.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Olá ${customerName.trim()},` : "Olá,",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} recusou o seu pedido de reserva${dateRange ? ` para ${dateRange}` : ""}.`,
      statusNote:
        "Os horários solicitados foram libertados e já não estão reservados para esta encomenda.",
      providerReasonLabel: "Nota do fornecedor",
      ctaLabel: "Ver encomendas",
      orderLabel: "Encomenda",
    },
  },
  ro: {
    createdCustomer: {
      heading: "Cerere de rezervare trimisă",
      subject: (tenantLabel) =>
        `Cerere de rezervare trimisă către ${tenantLabel}`,
      preview: (tenantLabel) =>
        `Cererea ta de rezervare a fost trimisă către ${tenantLabel}.`,
      intro: (tenantLabel, dateRange) =>
        `Cererea ta de rezervare a fost trimisă către ${tenantLabel}${dateRange ? ` pentru ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Furnizorul trebuie să confirme înainte ca rezervarea să fie programată.",
      cancellationNoteClosed:
        "Furnizorul trebuie să confirme înainte ca rezervarea să fie programată.",
      nextStepsNote:
        "Vei primi o actualizare după ce furnizorul confirmă sau refuză cererea.",
    },
    createdTenant: {
      heading: "Cerere nouă de rezervare",
      subject: "Cerere nouă de rezervare în așteptarea confirmării",
      preview: "Un client a trimis o cerere de rezervare.",
      intro: (customerName, dateRange) =>
        `${(customerName ?? "Un client").trim() || "Un client"} a trimis o cerere de rezervare${dateRange ? ` pentru ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Confirmați sau refuzați această cerere din panou.",
      cancellationNoteClosed:
        "Confirmați sau refuzați această cerere din panou.",
      nextStepsNote:
        "Confirmați cererea numai dacă puteți presta serviciul la ora solicitată.",
    },
    confirmedCustomer: {
      heading: "Cerere de rezervare confirmată",
      subject: (tenantLabel) => `Rezervare confirmată de ${tenantLabel}`,
      preview: (tenantLabel) =>
        `${tenantLabel} a confirmat cererea ta de rezervare.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Bună ${customerName.trim()},` : "Bună,",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} a confirmat cererea ta de rezervare${dateRange ? ` pentru ${dateRange}` : ""}. Rezervarea este acum programată.`,
      statusNote:
        "Poți vedea rezervarea programată din pagina ta de comenzi.",
      ctaLabel: "Vezi comenzile",
      orderLabel: "Comandă",
    },
    declinedCustomer: {
      heading: "Cerere de rezervare refuzată",
      subject: (tenantLabel) =>
        `Cerere de rezervare refuzată de ${tenantLabel}`,
      preview: (tenantLabel) =>
        `${tenantLabel} a refuzat cererea ta de rezervare.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Bună ${customerName.trim()},` : "Bună,",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} a refuzat cererea ta de rezervare${dateRange ? ` pentru ${dateRange}` : ""}.`,
      statusNote:
        "Intervalele solicitate au fost eliberate și nu mai sunt rezervate pentru această comandă.",
      providerReasonLabel: "Notă de la furnizor",
      ctaLabel: "Vezi comenzile",
      orderLabel: "Comandă",
    },
  },
  uk: {
    createdCustomer: {
      heading: "Запит на бронювання надіслано",
      subject: (tenantLabel) =>
        `Запит на бронювання надіслано ${tenantLabel}`,
      preview: (tenantLabel) =>
        `Ваш запит на бронювання надіслано ${tenantLabel}.`,
      intro: (tenantLabel, dateRange) =>
        `Ваш запит на бронювання надіслано ${tenantLabel}${dateRange ? ` на ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Постачальник ще має підтвердити його, перш ніж бронювання буде заплановано.",
      cancellationNoteClosed:
        "Постачальник ще має підтвердити його, перш ніж бронювання буде заплановано.",
      nextStepsNote:
        "Ви отримаєте оновлення, коли постачальник підтвердить або відхилить запит.",
    },
    createdTenant: {
      heading: "Новий запит на бронювання",
      subject: "Новий запит на бронювання очікує підтвердження",
      preview: "Клієнт надіслав запит на бронювання.",
      intro: (customerName, dateRange) =>
        `${(customerName ?? "Клієнт").trim() || "Клієнт"} надіслав запит на бронювання${dateRange ? ` на ${dateRange}` : ""}.`,
      cancellationNoteOpen:
        "Підтвердьте або відхиліть цей запит у панелі.",
      cancellationNoteClosed:
        "Підтвердьте або відхиліть цей запит у панелі.",
      nextStepsNote:
        "Підтверджуйте запит лише якщо можете надати послугу в запитаний час.",
    },
    confirmedCustomer: {
      heading: "Запит на бронювання підтверджено",
      subject: (tenantLabel) => `Бронювання підтверджено ${tenantLabel}`,
      preview: (tenantLabel) =>
        `${tenantLabel} підтвердив Ваш запит на бронювання.`,
      greeting: (customerName) =>
        customerName?.trim()
          ? `Вітаємо, ${customerName.trim()}!`
          : "Вітаємо!",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} підтвердив Ваш запит на бронювання${dateRange ? ` на ${dateRange}` : ""}. Тепер бронювання заплановано.`,
      statusNote:
        "Ви можете переглянути заплановане бронювання на сторінці замовлень.",
      ctaLabel: "Переглянути замовлення",
      orderLabel: "Замовлення",
    },
    declinedCustomer: {
      heading: "Запит на бронювання відхилено",
      subject: (tenantLabel) =>
        `Запит на бронювання відхилено ${tenantLabel}`,
      preview: (tenantLabel) =>
        `${tenantLabel} відхилив Ваш запит на бронювання.`,
      greeting: (customerName) =>
        customerName?.trim()
          ? `Вітаємо, ${customerName.trim()}!`
          : "Вітаємо!",
      intro: (tenantLabel, dateRange) =>
        `${tenantLabel} відхилив Ваш запит на бронювання${dateRange ? ` на ${dateRange}` : ""}.`,
      statusNote:
        "Запитані слоти звільнено, і вони більше не зарезервовані для цього замовлення.",
      providerReasonLabel: "Примітка постачальника",
      ctaLabel: "Переглянути замовлення",
      orderLabel: "Замовлення",
    },
  },
};

const ORDER_CANCELED_EMAIL_COPY: Record<
  AppLang,
  { customer: OrderCanceledCustomerCopy; tenant: OrderCanceledTenantCopy }
> = {
  en: {
    customer: {
      heading: "Order canceled",
      subject: (tenantLabel) => `Order canceled for ${tenantLabel}`,
      preview: (tenantLabel) => `Order canceled for ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Dear ${customerName.trim()},` : "Dear,",
      introCustomerCanceled: (tenantLabel, dateRange) =>
        `You canceled the order below with ${tenantLabel}${dateRange ? ` (${dateRange})` : ""}.`,
      introTenantCanceled: (tenantLabel, dateRange) =>
        `${tenantLabel} canceled the order below${dateRange ? ` (${dateRange})` : ""}.`,
      slotsReleasedNote: "The reserved slots have been released.",
      ctaLabel: "View Orders",
      orderLabel: "Order",
    },
    tenant: {
      heading: "Order canceled",
      subject: "Order canceled in your calendar",
      preview: "Order canceled in your calendar.",
      greeting: (tenantName) =>
        tenantName?.trim() ? `Dear ${tenantName.trim()},` : "Dear,",
      introCustomerCanceled: (customerName, dateRange) =>
        `${(customerName ?? "Your customer").trim() || "Your customer"} canceled the order below${dateRange ? ` (${dateRange})` : ""}.`,
      introTenantCanceled: (_customerName, dateRange) =>
        `You canceled the order below${dateRange ? ` (${dateRange})` : ""}.`,
      slotsReleasedNote: "The slots are available again in your calendar.",
      ctaLabel: "View Dashboard",
      orderLabel: "Order",
    },
  },
  de: {
    customer: {
      heading: "Bestellung storniert",
      subject: (tenantLabel) => `Bestellung storniert - ${tenantLabel}`,
      preview: (tenantLabel) => `Bestellung storniert - ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Hallo ${customerName.trim()},` : "Hallo,",
      introCustomerCanceled: (tenantLabel, dateRange) =>
        `Sie haben die folgende Bestellung bei ${tenantLabel}${dateRange ? ` (${dateRange})` : ""} storniert.`,
      introTenantCanceled: (tenantLabel, dateRange) =>
        `${tenantLabel} hat die folgende Bestellung${dateRange ? ` (${dateRange})` : ""} storniert.`,
      slotsReleasedNote:
        "Die reservierten Zeitfenster wurden wieder freigegeben.",
      ctaLabel: "Bestellungen ansehen",
      orderLabel: "Bestellung",
    },
    tenant: {
      heading: "Bestellung storniert",
      subject: "Bestellung in Ihrem Kalender storniert",
      preview: "Bestellung in Ihrem Kalender storniert.",
      greeting: (tenantName) =>
        tenantName?.trim() ? `Hallo ${tenantName.trim()},` : "Hallo,",
      introCustomerCanceled: (customerName, dateRange) =>
        `${(customerName ?? "Ihr Kunde").trim() || "Ihr Kunde"} hat die folgende Bestellung${dateRange ? ` (${dateRange})` : ""} storniert.`,
      introTenantCanceled: (_customerName, dateRange) =>
        `Sie haben die folgende Bestellung${dateRange ? ` (${dateRange})` : ""} storniert.`,
      slotsReleasedNote:
        "Die Zeitfenster sind in Ihrem Kalender wieder verfügbar.",
      ctaLabel: "Dashboard ansehen",
      orderLabel: "Bestellung",
    },
  },
  es: {
    customer: {
      heading: "Pedido cancelado",
      subject: (tenantLabel) => `Pedido cancelado - ${tenantLabel}`,
      preview: (tenantLabel) => `Pedido cancelado - ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Hola ${customerName.trim()},` : "Hola,",
      introCustomerCanceled: (tenantLabel, dateRange) =>
        `Has cancelado el pedido siguiente con ${tenantLabel}${dateRange ? ` (${dateRange})` : ""}.`,
      introTenantCanceled: (tenantLabel, dateRange) =>
        `${tenantLabel} canceló el pedido siguiente${dateRange ? ` (${dateRange})` : ""}.`,
      slotsReleasedNote: "Los turnos reservados han sido liberados.",
      ctaLabel: "Ver pedidos",
      orderLabel: "Pedido",
    },
    tenant: {
      heading: "Pedido cancelado",
      subject: "Pedido cancelado en tu calendario",
      preview: "Pedido cancelado en tu calendario.",
      greeting: (tenantName) =>
        tenantName?.trim() ? `Hola ${tenantName.trim()},` : "Hola,",
      introCustomerCanceled: (customerName, dateRange) =>
        `${(customerName ?? "Tu cliente").trim() || "Tu cliente"} canceló el pedido siguiente${dateRange ? ` (${dateRange})` : ""}.`,
      introTenantCanceled: (_customerName, dateRange) =>
        `Has cancelado el pedido siguiente${dateRange ? ` (${dateRange})` : ""}.`,
      slotsReleasedNote:
        "Los turnos vuelven a estar disponibles en tu calendario.",
      ctaLabel: "Ver panel",
      orderLabel: "Pedido",
    },
  },
  fr: {
    customer: {
      heading: "Commande annulée",
      subject: (tenantLabel) => `Commande annulée - ${tenantLabel}`,
      preview: (tenantLabel) => `Commande annulée - ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Bonjour ${customerName.trim()},` : "Bonjour,",
      introCustomerCanceled: (tenantLabel, dateRange) =>
        `Vous avez annulé la commande ci-dessous auprès de ${tenantLabel}${dateRange ? ` (${dateRange})` : ""}.`,
      introTenantCanceled: (tenantLabel, dateRange) =>
        `${tenantLabel} a annulé la commande ci-dessous${dateRange ? ` (${dateRange})` : ""}.`,
      slotsReleasedNote: "Les créneaux réservés ont été libérés.",
      ctaLabel: "Voir les commandes",
      orderLabel: "Commande",
    },
    tenant: {
      heading: "Commande annulée",
      subject: "Commande annulée dans votre calendrier",
      preview: "Commande annulée dans votre calendrier.",
      greeting: (tenantName) =>
        tenantName?.trim() ? `Bonjour ${tenantName.trim()},` : "Bonjour,",
      introCustomerCanceled: (customerName, dateRange) =>
        `${(customerName ?? "Votre client").trim() || "Votre client"} a annulé la commande ci-dessous${dateRange ? ` (${dateRange})` : ""}.`,
      introTenantCanceled: (_customerName, dateRange) =>
        `Vous avez annulé la commande ci-dessous${dateRange ? ` (${dateRange})` : ""}.`,
      slotsReleasedNote:
        "Les créneaux sont de nouveau disponibles dans votre calendrier.",
      ctaLabel: "Ouvrir Dashboard",
      orderLabel: "Commande",
    },
  },
  it: {
    customer: {
      heading: "Ordine annullato",
      subject: (tenantLabel) => `Ordine annullato - ${tenantLabel}`,
      preview: (tenantLabel) => `Ordine annullato - ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Ciao ${customerName.trim()},` : "Ciao,",
      introCustomerCanceled: (tenantLabel, dateRange) =>
        `Hai annullato l'ordine seguente con ${tenantLabel}${dateRange ? ` (${dateRange})` : ""}.`,
      introTenantCanceled: (tenantLabel, dateRange) =>
        `${tenantLabel} ha annullato l'ordine seguente${dateRange ? ` (${dateRange})` : ""}.`,
      slotsReleasedNote: "Gli slot riservati sono stati rilasciati.",
      ctaLabel: "Vedi ordini",
      orderLabel: "Ordine",
    },
    tenant: {
      heading: "Ordine annullato",
      subject: "Ordine annullato nel tuo calendario",
      preview: "Ordine annullato nel tuo calendario.",
      greeting: (tenantName) =>
        tenantName?.trim() ? `Ciao ${tenantName.trim()},` : "Ciao,",
      introCustomerCanceled: (customerName, dateRange) =>
        `${(customerName ?? "Il tuo cliente").trim() || "Il tuo cliente"} ha annullato l'ordine seguente${dateRange ? ` (${dateRange})` : ""}.`,
      introTenantCanceled: (_customerName, dateRange) =>
        `Hai annullato l'ordine seguente${dateRange ? ` (${dateRange})` : ""}.`,
      slotsReleasedNote:
        "Gli slot sono di nuovo disponibili nel tuo calendario.",
      ctaLabel: "Vedi Dashboard",
      orderLabel: "Ordine",
    },
  },
  pl: {
    customer: {
      heading: "Zamówienie anulowane",
      subject: (tenantLabel) => `Zamówienie anulowane - ${tenantLabel}`,
      preview: (tenantLabel) => `Zamówienie anulowane - ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Cześć ${customerName.trim()},` : "Cześć,",
      introCustomerCanceled: (tenantLabel, dateRange) =>
        `Anulowałeś poniższe zamówienie u ${tenantLabel}${dateRange ? ` (${dateRange})` : ""}.`,
      introTenantCanceled: (tenantLabel, dateRange) =>
        `Poniższe zamówienie zostało anulowane przez ${tenantLabel}${dateRange ? ` (${dateRange})` : ""}.`,
      slotsReleasedNote: "Zarezerwowane terminy zostały zwolnione.",
      ctaLabel: "Zobacz zamówienia",
      orderLabel: "Zamówienie",
    },
    tenant: {
      heading: "Zamówienie anulowane",
      subject: "Zamówienie anulowane w Twoim kalendarzu",
      preview: "Zamówienie anulowane w Twoim kalendarzu.",
      greeting: (tenantName) =>
        tenantName?.trim() ? `Cześć ${tenantName.trim()},` : "Cześć,",
      introCustomerCanceled: (customerName, dateRange) =>
        `Poniższe zamówienie zostało anulowane przez ${(customerName ?? "Twojego klienta").trim() || "Twojego klienta"}${dateRange ? ` (${dateRange})` : ""}.`,
      introTenantCanceled: (_customerName, dateRange) =>
        `Anulowałeś poniższe zamówienie${dateRange ? ` (${dateRange})` : ""}.`,
      slotsReleasedNote:
        "Terminy są ponownie dostępne w Twoim kalendarzu.",
      ctaLabel: "Zobacz panel",
      orderLabel: "Zamówienie",
    },
  },
  pt: {
    customer: {
      heading: "Encomenda cancelada",
      subject: (tenantLabel) => `Encomenda cancelada - ${tenantLabel}`,
      preview: (tenantLabel) => `Encomenda cancelada - ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Olá ${customerName.trim()},` : "Olá,",
      introCustomerCanceled: (tenantLabel, dateRange) =>
        `Cancelou a encomenda abaixo com ${tenantLabel}${dateRange ? ` (${dateRange})` : ""}.`,
      introTenantCanceled: (tenantLabel, dateRange) =>
        `${tenantLabel} cancelou a encomenda abaixo${dateRange ? ` (${dateRange})` : ""}.`,
      slotsReleasedNote: "Os horários reservados foram libertados.",
      ctaLabel: "Ver encomendas",
      orderLabel: "Encomenda",
    },
    tenant: {
      heading: "Encomenda cancelada",
      subject: "Encomenda cancelada no seu calendário",
      preview: "Encomenda cancelada no seu calendário.",
      greeting: (tenantName) =>
        tenantName?.trim() ? `Olá ${tenantName.trim()},` : "Olá,",
      introCustomerCanceled: (customerName, dateRange) =>
        `${(customerName ?? "O seu cliente").trim() || "O seu cliente"} cancelou a encomenda abaixo${dateRange ? ` (${dateRange})` : ""}.`,
      introTenantCanceled: (_customerName, dateRange) =>
        `Cancelou a encomenda abaixo${dateRange ? ` (${dateRange})` : ""}.`,
      slotsReleasedNote:
        "Os horários estão novamente disponíveis no seu calendário.",
      ctaLabel: "Ver painel",
      orderLabel: "Encomenda",
    },
  },
  ro: {
    customer: {
      heading: "Comandă anulată",
      subject: (tenantLabel) => `Comandă anulată - ${tenantLabel}`,
      preview: (tenantLabel) => `Comandă anulată - ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim() ? `Bună ${customerName.trim()},` : "Bună,",
      introCustomerCanceled: (tenantLabel, dateRange) =>
        `Ați anulat comanda de mai jos cu ${tenantLabel}${dateRange ? ` (${dateRange})` : ""}.`,
      introTenantCanceled: (tenantLabel, dateRange) =>
        `${tenantLabel} a anulat comanda de mai jos${dateRange ? ` (${dateRange})` : ""}.`,
      slotsReleasedNote: "Intervalele rezervate au fost eliberate.",
      ctaLabel: "Vezi comenzile",
      orderLabel: "Comandă",
    },
    tenant: {
      heading: "Comandă anulată",
      subject: "Comandă anulată în calendarul dvs.",
      preview: "Comandă anulată în calendarul dvs.",
      greeting: (tenantName) =>
        tenantName?.trim() ? `Bună ${tenantName.trim()},` : "Bună,",
      introCustomerCanceled: (customerName, dateRange) =>
        `${(customerName ?? "Clientul dvs.").trim() || "Clientul dvs."} a anulat comanda de mai jos${dateRange ? ` (${dateRange})` : ""}.`,
      introTenantCanceled: (_customerName, dateRange) =>
        `Ați anulat comanda de mai jos${dateRange ? ` (${dateRange})` : ""}.`,
      slotsReleasedNote:
        "Intervalele sunt din nou disponibile în calendarul dvs.",
      ctaLabel: "Vezi panoul",
      orderLabel: "Comandă",
    },
  },
  uk: {
    customer: {
      heading: "Замовлення скасовано",
      subject: (tenantLabel) => `Замовлення скасовано - ${tenantLabel}`,
      preview: (tenantLabel) => `Замовлення скасовано - ${tenantLabel}.`,
      greeting: (customerName) =>
        customerName?.trim()
          ? `Вітаємо, ${customerName.trim()}!`
          : "Вітаємо!",
      introCustomerCanceled: (tenantLabel, dateRange) =>
        `Ви скасували наведене нижче замовлення у ${tenantLabel}${dateRange ? ` (${dateRange})` : ""}.`,
      introTenantCanceled: (tenantLabel, dateRange) =>
        `${tenantLabel} скасував наведене нижче замовлення${dateRange ? ` (${dateRange})` : ""}.`,
      slotsReleasedNote: "Зарезервовані слоти було звільнено.",
      ctaLabel: "Переглянути замовлення",
      orderLabel: "Замовлення",
    },
    tenant: {
      heading: "Замовлення скасовано",
      subject: "Замовлення скасовано у Вашому календарі",
      preview: "Замовлення скасовано у Вашому календарі.",
      greeting: (tenantName) =>
        tenantName?.trim()
          ? `Вітаємо, ${tenantName.trim()}!`
          : "Вітаємо!",
      introCustomerCanceled: (customerName, dateRange) =>
        `${(customerName ?? "Ваш клієнт").trim() || "Ваш клієнт"} скасував наведене нижче замовлення${dateRange ? ` (${dateRange})` : ""}.`,
      introTenantCanceled: (_customerName, dateRange) =>
        `Ви скасували наведене нижче замовлення${dateRange ? ` (${dateRange})` : ""}.`,
      slotsReleasedNote:
        "Слоти знову доступні у Вашому календарі.",
      ctaLabel: "Переглянути панель",
      orderLabel: "Замовлення",
    },
  },
};

export function getOrderCreatedCustomerCopy(locale?: string) {
  const lang = resolveOrderEmailLang(locale);
  return {
    ...ORDER_EMAIL_COPY[lang].createdCustomer,
    ...ORDER_REQUEST_EMAIL_COPY[lang].createdCustomer,
  };
}

export function getOrderCreatedTenantCopy(locale?: string) {
  const lang = resolveOrderEmailLang(locale);
  return {
    ...ORDER_EMAIL_COPY[lang].createdTenant,
    ...ORDER_REQUEST_EMAIL_COPY[lang].createdTenant,
  };
}

export function getOrderRequestConfirmedCustomerCopy(locale?: string) {
  return ORDER_REQUEST_EMAIL_COPY[resolveOrderEmailLang(locale)]
    .confirmedCustomer;
}

export function getOrderRequestDeclinedCustomerCopy(locale?: string) {
  return ORDER_REQUEST_EMAIL_COPY[resolveOrderEmailLang(locale)]
    .declinedCustomer;
}

export function getOrderCanceledCustomerCopy(locale?: string) {
  return ORDER_CANCELED_EMAIL_COPY[resolveOrderEmailLang(locale)].customer;
}

export function getOrderCanceledTenantCopy(locale?: string) {
  return ORDER_CANCELED_EMAIL_COPY[resolveOrderEmailLang(locale)].tenant;
}
