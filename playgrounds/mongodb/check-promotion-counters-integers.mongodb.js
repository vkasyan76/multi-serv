/* eslint-disable */
// @ts-nocheck
// quick safety check for existing bad counter data,
const appDb = db.getSiblingDB("service_platform");

print("Counters with non-integer limit/used:");
printjson(
  appDb.promotion_counters
    .find({
      $or: [
        { $expr: { $ne: ["$limit", { $trunc: "$limit" }] } },
        { $expr: { $ne: ["$used", { $trunc: "$used" }] } },
      ],
    })
    .toArray(),
);
