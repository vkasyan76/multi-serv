// Metadata we attach to the Stripe Checkout Session / PaymentIntent
export type CheckoutMetadata = {
  orderId: string;
  userId: string; // Payload user id
  tenantId: string; // Payload tenant id
  slotIdsCsv: string; // comma-separated Booking ids
};

// Helper to parse the CSV back into ids
export function parseSlotIdsCsv(csv: string | null | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Reason: this is Stripe-only metadata (not part of Payload collections). Keeping it separate avoids accidental coupling and lets TS protect you where you actually build/read metadata.
