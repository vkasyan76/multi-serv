import type { CollectionConfig } from 'payload';

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: { useAsTitle: 'status' },
  access: {
    read: () => true,            // public can read (to paint the calendar)
    create: ({ req }) => !!req.user, // adjust later (tenant-only)
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'customer', type: 'relationship', relationTo: 'users' }, // null when "available"
    { name: 'start', type: 'date', required: true, index: true },    // ISO UTC
    { name: 'end', type: 'date', required: true },
    { name: 'mode', type: 'select', options: ['online','onsite'], required: true },
    {
      name: 'status',
      type: 'select',
      options: ['available','confirmed'],
      defaultValue: 'available',
      required: true,
      index: true,
    }, // optional, for later pricing
    { name: 'notes', type: 'textarea' },
  ],
  timestamps: true,
};
