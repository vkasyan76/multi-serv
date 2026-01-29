import type { CollectionConfig, PayloadRequest } from "payload";
import { isSuperAdmin } from "../lib/access.ts";

type RelValue = string | { id?: string } | null | undefined;

function relId(value: RelValue): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value.id === "string") return value.id;
  if (typeof (value as { _id?: unknown })._id === "string") {
    return (value as { _id?: string })._id ?? null;
  }
  return null;
}

async function syncOrderInvoiceCache(req: PayloadRequest, orderId: string) {
  // Recompute order.invoiceStatus based on all invoices for this order.
  const res = await req.payload.find({
    collection: "invoices",
    where: {
      and: [
        { order: { equals: orderId } },
        { status: { in: ["draft", "issued", "overdue", "paid", "void"] } },
      ],
    },
    limit: 100,
    depth: 0,
    sort: "-createdAt",
    overrideAccess: true,
  });

  const docs = res.docs ?? [];
  const paid = docs.find((d) => d.status === "paid");
  const overdue = docs.find((d) => d.status === "overdue");
  const issued = docs.find((d) => d.status === "issued");

  const nextStatus = paid
    ? "paid"
    : overdue
      ? "overdue"
      : issued
        ? "issued"
        : "none";

  if (process.env.NODE_ENV !== "production") {
    console.log("[syncOrderInvoiceCache]", {
      orderId,
      invoices: docs.length,
      nextStatus,
    });
  }

  try {
    await req.payload.update({
      collection: "orders",
      id: orderId,
      data: {
        invoiceStatus: nextStatus,
        // Keep these cache fields coherent when invoices are edited/removed.
        invoiceIssuedAt:
          paid?.issuedAt ?? overdue?.issuedAt ?? issued?.issuedAt ?? null,
        paidAt: paid?.paidAt ?? null,
      },
      overrideAccess: true,
      depth: 0,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[syncOrderInvoiceCache] update failed", err);
    }
    throw err;
  }
}

export const Invoices: CollectionConfig = {
  slug: "invoices",
  access: {
    // Keep admin-only; tRPC uses overrideAccess for controlled reads/writes.
    read: ({ req }) => isSuperAdmin(req.user),
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
    delete: ({ req }) => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[invoices.delete access]", {
          id: req.user?.id ?? null,
          roles: req.user?.roles ?? null,
        });
      }
      return process.env.NODE_ENV !== "production" && isSuperAdmin(req.user);
    },
  },
  admin: {
    useAsTitle: "status",
    defaultColumns: [
      "status",
      "order",
      "tenant",
      "customer",
      "amountTotalCents",
      "currency",
      "issuedAt",
      "paidAt",
    ],
  },
  hooks: {
    afterDelete: [
      async ({ doc, req }) => {
        // When an invoice is deleted through Payload, sync the order cache.
        if (process.env.NODE_ENV !== "production") {
          console.log("[invoices.afterDelete]", {
            id: (doc as { id?: string } | undefined)?.id ?? null,
            order: (doc as { order?: RelValue } | undefined)?.order ?? null,
          });
        }
        const orderId = relId((doc as { order?: RelValue }).order);
        if (orderId) await syncOrderInvoiceCache(req, orderId);
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        // Keep order cache aligned when invoice status or order relation changes.
        const orderId = relId((doc as { order?: RelValue }).order);
        const prevOrderId = relId(
          (previousDoc as { order?: RelValue } | undefined)?.order,
        );
        const prevStatus = (previousDoc as { status?: string } | undefined)
          ?.status;
        const nextStatus = (doc as { status?: string }).status;

        if (prevStatus === nextStatus && prevOrderId === orderId) return;

        if (orderId) await syncOrderInvoiceCache(req, orderId);
        if (prevOrderId && prevOrderId !== orderId) {
          await syncOrderInvoiceCache(req, prevOrderId);
        }
      },
    ],
  },
  fields: [
    {
      name: "order",
      type: "relationship",
      relationTo: "orders",
      required: true,
      index: true,
    },
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      required: true,
      index: true,
    },
    {
      name: "customer",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "issued",
      options: ["draft", "issued", "overdue", "paid", "void"],
      index: true,
    },
    {
      name: "currency",
      type: "text",
      required: true,
      defaultValue: "eur",
      index: true,
    },
    {
      name: "amountSubtotalCents",
      type: "number",
      required: true,
      admin: { description: "Subtotal in minor units (cents)." },
    },
    {
      name: "vatAmountCents",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: { description: "VAT amount in minor units (cents)." },
    },
    {
      name: "amountTotalCents",
      type: "number",
      required: true,
      admin: { description: "Total in minor units (cents)." },
    },
    // VAT snapshot (seller-side only for MVP)
    { name: "sellerCountryISO", type: "text", required: true },
    { name: "sellerVatRegistered", type: "checkbox", required: true },
    { name: "sellerVatId", type: "text" },
    {
      name: "vatRateBps",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: { description: "VAT rate in basis points (e.g. 1900 = 19%)." },
    },
    // Seller identity snapshot (tenant-issued invoice)
    { name: "sellerLegalName", type: "text", required: true },
    { name: "sellerAddressLine1", type: "text", required: true },
    { name: "sellerCity", type: "text", required: true },
    { name: "sellerPostal", type: "text", required: true },
    { name: "sellerEmail", type: "email" },
    // Buyer identity snapshot
    { name: "buyerName", type: "text", required: true },
    { name: "buyerAddressLine1", type: "text", required: true },
    { name: "buyerCity", type: "text", required: true },
    { name: "buyerPostal", type: "text", required: true },
    { name: "buyerCountryISO", type: "text", required: true },
    { name: "buyerEmail", type: "email" },
    // VAT policy snapshot (audit/debug)
    { name: "vatPolicy", type: "text" },
    // Line items snapshot at issuance time
    {
      name: "lineItems",
      type: "array",
      fields: [
        { name: "slotId", type: "text", required: true },
        { name: "title", type: "text", required: true },
        { name: "qty", type: "number", required: true, defaultValue: 1 },
        { name: "unitAmountCents", type: "number", required: true },
        { name: "amountCents", type: "number", required: true },
        { name: "start", type: "date", required: true },
        { name: "end", type: "date", required: false },
      ],
    },
    // Checkout Session fields (pay-after-acceptance flow)
    { name: "stripeCheckoutSessionId", type: "text", index: true },
    { name: "stripePaymentIntentId", type: "text", index: true },
    { name: "issuedAt", type: "date", index: true },
    { name: "paidAt", type: "date", index: true },
  ],
  timestamps: true,
};
