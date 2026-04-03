// storage-adapter-import-placeholder
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { payloadCloudPlugin } from "@payloadcms/payload-cloud";
import { multiTenantPlugin } from "@payloadcms/plugin-multi-tenant";
import { vercelBlobStorage } from "@payloadcms/storage-vercel-blob";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { buildConfig } from "payload";
import { fileURLToPath } from "url";
import sharp from "sharp";

import { Users } from "./collections/Users.ts";
import { Media } from "./collections/Media.ts";
import { Categories } from "./collections/Categories.ts";

import { Config } from "@payload-types";
import { isSuperAdmin } from "./lib/access.ts";
import { Tenants } from "./collections/Tenants.ts";
import { Tags } from "./collections/Tags.ts";
import { Bookings } from "./collections/Bookings.ts";
import { Orders } from "./collections/Orders.ts";
import { Invoices } from "./collections/Invoices.ts";
import { Reviews } from "./collections/Reviews.ts";
import { Conversations } from "./collections/Conversations.ts";
import { Messages } from "./collections/Messages.ts";
import { PaymentProfiles } from "./collections/PaymentProfiles.ts";
import { EmailEventLogs } from "./collections/EmailEventLogs.ts";
import { CommissionEvents } from "./collections/CommissionEvents.ts";
import { CommissionStatements } from "./collections/CommissionStatements.ts";
import { Promotions } from "./collections/Promotions.ts";
import { PromotionCounters } from "./collections/PromotionCounters.ts";
import { PromotionAllocations } from "./collections/PromotionAllocations.ts";
import { DEFAULT_APP_LANG, SUPPORTED_LANGUAGES } from "./lib/i18n/app-lang.ts";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

type IndexableCollection = {
  createIndex: (
    keys: Record<string, 1 | -1>,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
};

// Payload's Mongo adapter can expose collection handles either directly on the model
// or under model.collection depending on runtime shape. This helper normalizes both
// forms so partial/unique indexes are always applied during onInit.
function getIndexableCollection(
  payload: { db: { collections?: Record<string, unknown> } },
  slug: string,
): IndexableCollection | undefined {
  const model = payload.db.collections?.[slug] as
    | { createIndex?: unknown; collection?: { createIndex?: unknown } }
    | undefined;
  if (!model) return undefined;

  if (typeof model.createIndex === "function") {
    return model as unknown as IndexableCollection;
  }

  if (model.collection && typeof model.collection.createIndex === "function") {
    return model.collection as IndexableCollection;
  }

  return undefined;
}

function isIgnorableIndexError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = String((error as { message?: unknown }).message ?? "");
  return /already exists/i.test(message) && !/different|conflict/i.test(message);
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  localization: {
    locales: SUPPORTED_LANGUAGES.map(({ code, label }) => ({
      code,
      label,
    })),
    defaultLocale: DEFAULT_APP_LANG,
    fallback: true,
  },
  collections: [
    Users,
    Media,
    Categories,
    Tenants,
    Tags,
    Bookings,
    Orders,
    Invoices,
    Reviews,
    Conversations,
    Messages,
    PaymentProfiles,
    EmailEventLogs,
    CommissionEvents,
    CommissionStatements,
    Promotions,
    PromotionCounters,
    PromotionAllocations,
  ],
  // cookiePrefix: "funroad",  // optional: if we want to change the cookie prefix
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || "",
  }),
  onInit: async (payload) => {
    // Create Mongo partial unique indexes here because Payload collection
    // config indexes do not expose partialFilterExpression.
    const allocations = getIndexableCollection(
      payload as unknown as { db: { collections?: Record<string, unknown> } },
      "promotion_allocations",
    );
    const promotions = getIndexableCollection(
      payload as unknown as { db: { collections?: Record<string, unknown> } },
      "promotions",
    );

    if (!allocations?.createIndex) {
      // Keep this warning explicit: missing handles mean critical unique constraints are not applied.
      payload.logger.warn(
        "promotion_allocations collection handle missing; skipped partial unique index creation",
      );
    } else {
      try {
        await allocations.createIndex(
          { promotion: 1, invoice: 1 },
          {
            name: "uniq_promo_invoice_when_invoice_present",
            unique: true,
            partialFilterExpression: {
              invoice: { $exists: true },
            },
          },
        );
      } catch (error) {
        if (!isIgnorableIndexError(error)) throw error;
      }

      try {
        await allocations.createIndex(
          { stripePaymentIntentId: 1 },
          {
            name: "uniq_promo_allocation_pi_when_present",
            unique: true,
            partialFilterExpression: {
              stripePaymentIntentId: { $exists: true },
            },
          },
        );
      } catch (error) {
        if (!isIgnorableIndexError(error)) throw error;
      }

      try {
        // Idempotency guard: one allocation per reservationKey (retry-safe checkout attempts).
        await allocations.createIndex(
          { reservationKey: 1 },
          {
            name: "uniq_promo_allocation_reservation_key_when_present",
            unique: true,
            partialFilterExpression: {
              reservationKey: { $exists: true },
            },
          },
        );
      } catch (error) {
        if (!isIgnorableIndexError(error)) throw error;
      }
    }

    if (!promotions?.createIndex) {
      payload.logger.warn(
        "promotions collection handle missing; skipped referral partial unique index creation",
      );
    } else {
      try {
        await promotions.createIndex(
          { referralCode: 1 },
          {
            name: "uniq_active_referral_code",
            unique: true,
            partialFilterExpression: {
              active: true,
              scope: "referral",
              referralCode: { $exists: true },
            },
          },
        );
      } catch (error) {
        if (!isIgnorableIndexError(error)) throw error;
      }
    }
  },
  sharp,
  plugins: [
    payloadCloudPlugin(),
    // storage-adapter-placeholder
    multiTenantPlugin<Config>({
      collections: {
        // products: {},
        media: {}, // private media accessable only to the tenant
      },
      tenantsArrayField: {
        includeDefaultField: false,
      },
      userHasAccessToAllTenants: (user) =>
        // Boolean(user?.roles?.includes("super-admin")),
        isSuperAdmin(user), // import from "@/lib/access.ts"
    }),
    // vercel blob storage plugin:
    vercelBlobStorage({
      enabled: true, // Optional, defaults to true
      clientUploads: true, // to enable client uploads
      // Specify which collections should use Vercel Blob
      collections: {
        media: true,
      },
      // Token provided by Vercel once Blob storage is added to your Vercel project
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }),
  ],
});
