/* eslint-disable */
// @ts-nocheck

/*
  Reset + recreate reservationKey index for promotion allocations.
  Run with no selection highlighted.
*/

const appDb = db.getSiblingDB("service_platform"); // Change DB name if needed.
const INDEX_NAME = "uniq_promo_allocation_reservation_key_when_present";

// Normalize empty values so the partial unique index stays predictable.
appDb.promotion_allocations.updateMany(
  { reservationKey: { $in: [null, ""] } },
  { $unset: { reservationKey: "" } },
);

// Fail fast if duplicate non-empty keys exist.
const duplicates = appDb.promotion_allocations
  .aggregate([
    { $match: { reservationKey: { $exists: true } } },
    { $group: { _id: "$reservationKey", count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } },
  ])
  .toArray();

if (duplicates.length) {
  print("Duplicate reservationKey values found. Resolve these before creating unique index.");
  printjson(duplicates);
} else {
  try {
    appDb.promotion_allocations.dropIndex(INDEX_NAME);
  } catch (e) {}
  try {
    appDb.promotion_allocations.dropIndex("reservationKey_1");
  } catch (e) {}

  const created = appDb.promotion_allocations.createIndex(
    { reservationKey: 1 },
    {
      name: INDEX_NAME,
      unique: true,
      partialFilterExpression: { reservationKey: { $exists: true } },
    },
  );

  print("createIndex result:");
  printjson(created);
}

