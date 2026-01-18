// src/scripts/clear-orders.ts
import "dotenv/config";
import { MongoClient, type Filter, type Document } from "mongodb";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// 1) Read envs into a temp var
const rawUri =
  process.env.DATABASE_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.MONGODB_URL;

// 2) Guard + narrow
if (!rawUri) {
  console.error("❌ Set DATABASE_URI or MONGODB_URI in your .env");
  process.exit(1);
}
const uri: string = rawUri; // now definitely a string

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

// ---- flags
const args = process.argv.slice(2);
let filter: Filter<Document>; // non-nullable

if (args.includes("--unpaid")) {
  filter = { status: { $in: ["pending", "canceled"] } };
} else if (args.includes("--paid")) {
  filter = { status: "paid" };
} else if (args.includes("--all")) {
  filter = {};
} else {
  console.log(
    "Usage: clear-orders.ts [--unpaid | --paid | --all] [--backup]\n" +
      "  --unpaid  Delete only pending/canceled orders\n" +
      "  --paid    Delete only paid orders\n" +
      "  --all     Delete ALL orders\n" +
      "  --backup  Save matching orders to tmp/orders-backup-<ts>.json before deleting",
  );
  process.exit(1);
}

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();

    const col = client.db(dbName).collection("orders");

    const before = await col.countDocuments({});
    const target = await col.countDocuments(filter);

    // optional backup
    if (args.includes("--backup")) {
      const docs = await col.find(filter).toArray();
      await mkdir("tmp", { recursive: true });
      const file = join("tmp", `orders-backup-${Date.now()}.json`);
      await writeFile(file, JSON.stringify(docs, null, 2), "utf8");
      console.log(`✅ Backup written: ${file} (${docs.length} docs)`);
    }

    const res = await col.deleteMany(filter);
    const after = await col.countDocuments({});

    console.log(
      `DB=${dbName} | Filter=${JSON.stringify(filter)} | Deleted=${res.deletedCount} (target=${target}) | before=${before} -> after=${after}`,
    );
  } finally {
    // ensure the connection is closed even if something throws
    await client.close().catch(() => {});
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
