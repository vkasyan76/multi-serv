// src/scripts/cancel-stale-orders.ts
import "dotenv/config";
import { MongoClient, type Filter } from "mongodb";

/** Minimal shape of a booking doc we update */
type BookingDoc = {
  id: string; // your collections use "id" (string), not _id
  status: "available" | "booked" | "confirmed" | "canceled";
  customer?: string | null;
};

/** Only fields we read from orders */
type StaleOrderDb = {
  id: string;
  user?: string | { id: string } | null;
  slots?: string[] | null;
  reservedUntil?: string | null;
  status?: string;
};

// ---- connection (same pattern as your other scripts)
const rawUri =
  process.env.DATABASE_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.MONGODB_URL;

if (!rawUri) {
  console.error("❌ Set DATABASE_URI or MONGODB_URI in your .env");
  process.exit(1);
}
const uri: string = rawUri;

function dbNameFromUri(u: string) {
  try {
    const url = new URL(u);
    const name = url.pathname.replace(/^\//, "");
    return name || "service_platform";
  } catch {
    return "service_platform";
  }
}
const dbName = process.env.MONGODB_DB || dbNameFromUri(uri);

async function cancelStaleOrders() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);

    const orders = db.collection<StaleOrderDb>("orders");
    const bookings = db.collection<BookingDoc>("bookings"); // ✅ typed collection

    const nowIso = new Date().toISOString();

    // 1) find pending orders past reservedUntil
    const stale = await orders
      .find({
        status: "pending",
        reservedUntil: { $lt: nowIso },
      })
      .project<StaleOrderDb>({ id: 1, user: 1, slots: 1, _id: 0 })
      .toArray();

    if (!stale.length) {
      console.log("No pending orders past reservedUntil.");
      return;
    }

    for (const order of stale) {
      const orderId = order.id;
      const slotIds: string[] = Array.isArray(order.slots) ? order.slots : [];

      // normalize user id (optional guard)
      const orderUserId =
        typeof order.user === "string"
          ? order.user
          : order.user && typeof order.user === "object"
            ? order.user.id
            : undefined;

      // 2) cancel the order (filter by string "id", not _id)
      await orders.updateOne(
        { id: orderId, status: "pending" },
        { $set: { status: "canceled" } }
      );

      // 3) release bookings still "booked" (optionally require same customer)
      if (slotIds.length) {
        const where: Filter<BookingDoc> = {
          id: { $in: slotIds },
          status: "booked",
          ...(orderUserId ? { customer: orderUserId } : {}),
        };

        const res = await bookings.updateMany(where, {
          $set: { status: "available", customer: null },
        });

        console.log(
          `Canceled order ${orderId} and released ${res.modifiedCount}/${slotIds.length} booking(s).`
        );
      } else {
        console.log(`Canceled order ${orderId} (no slots to release).`);
      }
    }
  } finally {
    // ensure the connection is closed even if something throws
    await client.close().catch(() => {});
  }
}

cancelStaleOrders()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
