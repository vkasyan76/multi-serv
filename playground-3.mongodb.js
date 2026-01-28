/* eslint-disable react-hooks/rules-of-hooks */

use("service_platform");

// 1) Show invoices
db.invoices
  .find({}, { _id: 1, status: 1, order: 1, createdAt: 1 })
  .sort({ createdAt: -1 });

// 2) Show orders not "none"
db.orders
  .find(
    { invoiceStatus: { $ne: "none" } },
    { _id: 1, invoiceStatus: 1, invoiceIssuedAt: 1, paidAt: 1, updatedAt: 1 },
  )
  .sort({ updatedAt: -1 });

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
