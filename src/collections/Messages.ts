import type { CollectionConfig } from "payload";
import { isSuperAdmin } from "../lib/access";

export const Messages: CollectionConfig = {
  slug: "messages",
  indexes: [{ fields: ["conversation", "createdAt"] }],
  admin: {
    useAsTitle: "text",
  },
  // App users (Clerk) are NOT Payload-auth users, so keep Payload access to admins only.
  // Your tRPC procedures use overrideAccess:true anyway.
  access: {
    read: ({ req }) => isSuperAdmin(req.user),
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  fields: [
    {
      name: "conversation",
      type: "relationship",
      relationTo: "conversations",
      required: true,
      index: true,
    },
    {
      name: "senderRole",
      type: "select",
      required: true,
      options: [
        { label: "Customer", value: "customer" },
        { label: "Tenant", value: "tenant" },
      ],
      index: true,
    },
    {
      name: "senderUser",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "text",
      type: "textarea",
      required: true,
    },
    {
      name: "deletedAt",
      type: "date",
      required: false,
      admin: { position: "sidebar", readOnly: true },
    },
  ],
};
