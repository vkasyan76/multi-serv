import { CANCELLATION_WINDOW_HOURS } from "@/constants";
import { normalizeToSupported, type AppLang } from "@/lib/i18n/app-lang";

type OrderCreatedCustomerCopy = {
  heading: string;
  subject: (tenantLabel: string) => string;
  preview: (tenantLabel: string) => string;
  greeting: (customerName?: string) => string;
  intro: (tenantLabel: string, dateRange?: string | null) => string;
  cancellationNoteOpen: string;
  cancellationNoteClosed: string;
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
  const normalized = (language ?? "").trim();
  if (normalized && /[-_]/.test(normalized)) {
    return normalized.replace("_", "-");
  }

  switch (normalized.toLowerCase()) {
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

// Keep this helper local to order emails until a broader email-copy pattern is needed.
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
        "Cette commande peut être annulée jusqu’à 24 heures avant le premier créneau prévu par vous ou par le client depuis le menu d’actions Réservations du Dashboard.",
      cancellationNoteClosed:
        "Cette commande est déjà dans la période de moins de 24 heures et ne peut plus être annulée ni par vous ni par le client depuis le menu d’actions Réservations du Dashboard.",
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
        "Це замовлення можна скасувати не пізніше ніж за 24 години до першого запланованого слота Вами або клієнтом через меню дій у розділі замовлення в панелі.",
      cancellationNoteClosed:
        "Це замовлення вже в межах 24-годинного обмеження, тому його більше не можна скасувати ні Вами, ні клієнтом через меню дій у розділі замовлення в панелі.",
      ctaLabel: "Переглянути панель",
      orderLabel: "Замовлення",
    },
  },
};

export function getOrderCreatedCustomerCopy(locale?: string) {
  return ORDER_EMAIL_COPY[resolveOrderEmailLang(locale)].createdCustomer;
}

export function getOrderCreatedTenantCopy(locale?: string) {
  return ORDER_EMAIL_COPY[resolveOrderEmailLang(locale)].createdTenant;
}
