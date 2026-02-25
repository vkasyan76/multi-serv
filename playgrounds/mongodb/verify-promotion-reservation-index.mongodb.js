/* eslint-disable */
// @ts-nocheck

/*
  Verify reservationKey unique partial index for promotion allocations.
*/

const appDb = db.getSiblingDB("service_platform"); // Change DB name if needed.
const INDEX_NAME = "uniq_promo_allocation_reservation_key_when_present";

const idx = appDb.promotion_allocations.getIndexes().find((i) => i.name === INDEX_NAME);

if (!idx) {
  print(`MISSING index: ${INDEX_NAME}`);
  print("Available index names:");
  printjson(appDb.promotion_allocations.getIndexes().map((i) => i.name));
} else {
  print("Found index:");
  printjson(idx);
  print(`keyOk: ${JSON.stringify(idx.key) === JSON.stringify({ reservationKey: 1 })}`);
  print(`uniqueOk: ${idx.unique === true}`);
  print(
    `partialOk: ${JSON.stringify(idx.partialFilterExpression) === JSON.stringify({ reservationKey: { $exists: true } })}`,
  );
}

