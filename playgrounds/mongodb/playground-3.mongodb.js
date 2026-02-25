/* eslint-disable react-hooks/rules-of-hooks */

use("service_platform");

// 1) Show invoices
// db.invoices
//   .find({}, { _id: 1, status: 1, order: 1, createdAt: 1 })
//   .sort({ createdAt: -1 });

// // 2) Show orders not "none"
// db.orders
//   .find(
//     { invoiceStatus: { $ne: "none" } },
//     { _id: 1, invoiceStatus: 1, invoiceIssuedAt: 1, paidAt: 1, updatedAt: 1 },
//   )
//   .sort({ updatedAt: -1 });

// 3) (Optional) Reset ALL orders with non-none status
// ⚠️ Uncomment to apply
/*
db.orders.updateMany(
  { invoiceStatus: { $ne: "none" } },
  { $set: { invoiceStatus: "none", invoiceIssuedAt: null, paidAt: null } }
);
*/

// updated impacted orders

// db.orders.updateMany(
//   {
//     _id: {
//       $in: [
//         ObjectId("696e1ba9ede4461e9820a1f4"),
//         ObjectId("696e76dad1c1f443142dc2f8"),
//         ObjectId("696e76c2d1c1f443142dc2aa"),
//       ],
//     },
//   },
//   { $set: { invoiceStatus: "none", invoiceIssuedAt: null, paidAt: null } },
// );

// const id = "696e76c2d1c1f443142dc2aa";

// db.invoices
//   .find(
//     { $or: [{ order: id }, { order: ObjectId(id) }] },
//     { _id: 1, order: 1, status: 1, createdAt: 1 },
//   )
//   .sort({ createdAt: -1 });

// db.orders.aggregate([
//   { $match: { invoiceStatus: { $ne: "none" } } },
//   {
//     $lookup: {
//       from: "invoices",
//       localField: "_id",
//       foreignField: "order",
//       as: "inv_by_objectId",
//     },
//   },
//   {
//     $lookup: {
//       from: "invoices",
//       localField: "_id",
//       foreignField: "order.id",
//       as: "inv_by_embeddedId",
//     },
//   },
//   {
//     $project: {
//       invoiceStatus: 1,
//       invoiceIssuedAt: 1,
//       paidAt: 1,
//       inv_by_objectId_count: { $size: "$inv_by_objectId" },
//       inv_by_embeddedId_count: { $size: "$inv_by_embeddedId" },
//     },
//   },
//   { $sort: { invoiceIssuedAt: -1 } },
//   { $limit: 20 },
// ]);

// slots

// db.orders
//   .find(
//     { lifecycleMode: "slot" },
//     {
//       _id: 1,
//       lifecycleMode: 1,
//       invoiceStatus: 1,
//       invoiceIssuedAt: 1,
//       paidAt: 1,
//       updatedAt: 1,
//       amount: 1,
//       currency: 1,
//       tenant: 1,
//       user: 1,
//       serviceStatus: 1,
//     },
//   )
//   .sort({ updatedAt: -1 })
//   .limit(500);

// invoice

// use("service_platform");
// db.invoices.aggregate([
//   { $project: { orderType: { $type: "$order" } } },
//   { $group: { _id: "$orderType", count: { $sum: 1 } } },
// ]);

use("service_platform");
// supporting ObjectId in queries

db.invoices.find({}, { _id: 1, order: 1 }).limit(5);
