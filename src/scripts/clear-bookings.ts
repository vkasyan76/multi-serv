import "dotenv/config";
import { MongoClient } from "mongodb";

// Uses Payload's DATABASE_URI, falls back to MONGODB_URI
const uri =
  process.env.DATABASE_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.MONGODB_URL;

if (!uri) {
  console.error("❌ Set DATABASE_URI or MONGODB_URI in your .env");
  process.exit(1);
}

// get DB name from ".../service_platform" in the URI, or env override
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

async function run() {
  const client = new MongoClient(uri as string);
  await client.connect();

  const col = client.db(dbName).collection("bookings");

  const before = await col.countDocuments({});
  const res = await col.deleteMany({}); // ← delete ALL docs
  const after = await col.countDocuments({});

  console.log(
    `DB=${dbName} | Deleted ${res.deletedCount} docs (before=${before}, after=${after})`
  );

  await client.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
