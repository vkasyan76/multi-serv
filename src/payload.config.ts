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

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Categories, Tenants, Tags, Bookings, Orders],
  // cookiePrefix: "funroad",  // optional: if we want to change the cookie prefix
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || "",
  }),
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
