# Terms Of Use Translation Reference

Use this file when preparing translated Terms of Use so legal copy stays aligned
with the UI vocabulary already used in the app.

## Source Of Truth

- Raw system values: [src/constants.ts](c:/Users/vkasy/OneDrive/Documents/Webdesign/NEXT_JS/MULTI/multi-serv/src/constants.ts)
- Terms renderer: [src/modules/legal/terms-of-use/terms-v1.tsx](c:/Users/vkasy/OneDrive/Documents/Webdesign/NEXT_JS/MULTI/multi-serv/src/modules/legal/terms-of-use/terms-v1.tsx)
- Orders page labels: [src/i18n/messages/*/orders.json](c:/Users/vkasy/OneDrive/Documents/Webdesign/NEXT_JS/MULTI/multi-serv/src/i18n/messages/en/orders.json)
- Bookings labels: [src/i18n/messages/*/bookings.json](c:/Users/vkasy/OneDrive/Documents/Webdesign/NEXT_JS/MULTI/multi-serv/src/i18n/messages/en/bookings.json)
- Finance / invoice labels: [src/i18n/messages/*/finance.json](c:/Users/vkasy/OneDrive/Documents/Webdesign/NEXT_JS/MULTI/multi-serv/src/i18n/messages/en/finance.json)
- Dashboard label: [src/i18n/messages/*/common.json](c:/Users/vkasy/OneDrive/Documents/Webdesign/NEXT_JS/MULTI/multi-serv/src/i18n/messages/en/common.json)

## Current Terms Behavior

- Section 2 of the Terms page shows only localized user-facing labels.
- It does not display raw enum values such as `scheduled` or `paid`.
- Service-status labels in Section 2 come from `orders.status.*`.
- Booking payment-status labels in Section 2 come from `bookings.payment_status.*`.

## How To Use This With ChatGPT

1. If the Terms page refers to a visible page, button, badge, or section,
   reuse the exact localized UI term from the tables below.
2. For Section 2 status lists, translate to the same user-facing labels the app
   already shows in Orders and Bookings.
3. Do not expose raw enum values in the translated Terms page unless you are
   intentionally changing the product decision.
4. Do not invent alternate nouns for core navigation.
   Example: if the locale uses `Commandes`, do not switch to `Réservations`.
5. Do not blindly copy badge adjectives into prose if grammar would become
   awkward.
   Example: French badge labels like `Planifiée` and `Acceptée` are UI labels;
   in legal prose, rewrite the sentence naturally.

## Canonical Raw System Values

These remain the internal source-of-truth values in code. They are useful as a
mapping reference for translators, but they are not shown in Section 2 of the
current Terms page.

### Service status

- `scheduled`
- `completed`
- `accepted`
- `disputed`

### Booking payment status

- `unpaid`
- `pending`
- `paid`

### Invoice / order payment lifecycle

- `draft`
- `issued`
- `overdue`
- `paid`
- `void`

## UI Nouns By Locale

Use these when the Terms mention visible destinations like Orders or Dashboard.

| Locale | Orders page title | Short Orders CTA | Dashboard |
| --- | --- | --- | --- |
| `en` | My Orders | Orders | Dashboard |
| `de` | Meine Bestellungen | Bestellungen | Dashboard |
| `es` | Mis pedidos | Pedidos | Panel |
| `fr` | Mes commandes | Commandes | Dashboard |
| `it` | I miei ordini | Ordini | Dashboard |
| `pl` | Moje zamówienia | Zamówienia | Panel |
| `pt` | As minhas encomendas | Encomendas | Painel |
| `ro` | Comenzile mele | Comenzi | Panou |
| `uk` | Мої замовлення | Замовлення | Панель |

## Section 2 Service Status Labels By Locale

These are the localized labels currently shown by the Terms page via
`orders.status.*`.

| Raw value | en | de | es | fr | it | pl | pt | ro | uk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `scheduled` | Scheduled | Geplant | Programado | Planifiée | Programmato | Zaplanowane | Agendado | Programat | Заплановано |
| `completed` | Completed | Abgeschlossen | Completado | Terminée | Completato | Zakończone | Concluído | Finalizat | Завершено |
| `accepted` | Accepted | Akzeptiert | Aceptado | Acceptée | Accettato | Zaakceptowane | Aceite | Acceptat | Прийнято |
| `disputed` | Disputed | Beanstandet | Impugnado | Contestée | Contestato | Sporne | Contestado | Contestat | Оскаржено |

## Section 2 Booking Payment Status Labels By Locale

These are the localized labels currently shown by the Terms page via
`bookings.payment_status.*`.

| Raw value | en | de | es | fr | it | pl | pt | ro | uk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `unpaid` | Unpaid | Unbezahlt | No pagado | Non payé | Non pagato | Nieopłacone | Não pago | Neplătit | Не оплачено |
| `pending` | Pending | Ausstehend | Pendiente | En attente | In sospeso | Oczekujące | Pendente | În așteptare | Очікується |
| `paid` | Paid | Bezahlt | Pagado | Payé | Pagato | Opłacone | Pago | Plătit | Оплачено |

## Orders Payment Badge Labels By Locale

These are the compact payment-status labels currently shown in Orders tables.

| Meaning | en | de | es | fr | it | pl | pt | ro | uk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| paid | paid | bezahlt | pagado | payée | pagato | opłacone | pago | plătită | оплачено |
| payment due | payment due | Zahlung fällig | pago pendiente | paiement dû | pagamento dovuto | płatność wymagana | pagamento em falta | plată datorată | платіж очікується |
| not invoiced yet | not invoiced yet | noch nicht fakturiert | aún no facturado | pas encore facturé | non ancora fatturato | jeszcze niezafakturowane | ainda não faturado | încă nefacturat | ще без рахунку |

## Finance Invoice Status Labels By Locale

Use these if the Terms mention invoice states in a way that should match the
finance UI.

| Raw value | en | de | es | fr | it | pl | pt | ro | uk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `draft` | Draft | Entwurf | Borrador | Brouillon | Bozza | Szkic | Rascunho | Ciornă | Чернетка |
| `issued` | Issued | Ausgestellt | Emitida | Émise | Emessa | Wystawiona | Emitida | Emisă | Виставлено |
| `overdue` | Overdue | Überfällig | Vencida | En retard | Scaduta | Przeterminowana | Vencida | Restanță | Прострочено |
| `paid` | Paid | Bezahlt | Pagada | Payée | Pagata | Opłacona | Paga | Plătită | Оплачено |
| `void` | Void | Storniert | Anulada | Annulée | Annullata | Anulowana | Anulada | Anulată | Скасовано |

## Recommended Prompt Add-On For ChatGPT

Use this when asking ChatGPT to translate the Terms:

```text
Translate the Terms of Use into the target app language.

Important consistency rules:
- Reuse the exact localized UI labels from the provided reference tables for
  Section 2 service and payment status lists.
- Do not expose raw enum values such as `scheduled`, `completed`, `accepted`,
  `disputed`, `unpaid`, `pending`, or `paid` in the translated Terms page.
- If the text refers to visible UI labels such as Orders or Dashboard, reuse the
  exact localized label from the provided reference table.
- Do not invent alternate product nouns such as replacing Orders with Bookings or
  Dashboard with another term if the UI already uses a fixed label.
- Do not blindly copy badge adjectives into prose if the grammar becomes awkward;
  prefer natural legal prose while keeping the same meaning.
```

## Notes

- The Terms page is legal/product copy, not API or developer documentation.
- For translated legal prose, natural grammar matters.
- For Section 2 status lists, use the exact localized UI labels already wired in
  the app.
- Keep the raw enum mapping documented here for translator reference only.
