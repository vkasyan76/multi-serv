import z from "zod";

const usernameValidation = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(63, "Username must be less than 63 characters")
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    "Username can only contain lowercase letters, numbers and hyphens. It must start and end with a letter or number"
  )
  .refine(
    (val) => !val.includes("--"),
    "Username cannot contain consecutive hyphens"
  )
  .transform((val) => val.toLowerCase());

export const profileSchema = z.object({
  username: usernameValidation,
  email: z.string().email("Invalid email address"),
  location: z.string().min(3, "Please select a location"),
  country: z.string().min(2, "Country required"),
  language: z.enum(["en", "es", "fr", "de", "it", "pt"]),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
});

export const PROFILE_FIELD_LABELS: Record<string, string> = {
  username: "Username",
  email: "Email address",
  location: "Location",
  country: "Country",
  language: "Language",
};

export const vendorSchema = z.object({
  name: z.string().min(2, "Business name is required"),
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  bio: z
    .string()
    .max(600, "Description must be under 600 characters")
    .optional(),
  services: z
    .array(z.enum(["on-site", "on-line"]))
    .min(1, "Select at least one service type"),
  // category: z.string().min(1, "Please select a category"),
  categories: z.array(z.string()).min(1, "Select at least one category"),
  subcategories: z.array(z.string()).optional(),
  website: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^https?:\/\//.test(val) || /^www\./.test(val), // or use a more advanced URL check
      { message: "Website must be a valid URL." }
    ),
  image: z.string().optional(),
  phone: z
    .string()
    .optional()
    .refine((val) => val === undefined || val === "" || /^\+?[1-9]\d{3,14}$/.test(val), {
      message: "Must be a valid international phone number in E.164 format",
    }),
  // hourlyRate: z
  //   .number({ invalid_type_error: "Hourly rate must be a number" })
  //   .min(1, "Hourly rate must be at least 1 EUR")
  //   .max(10000, "Hourly rate seems too high")
  //   .refine((val) => /^\d+(\.\d{1,2})?$/.test(val.toString()), {
  //     message: "Hourly rate must have at most two decimal places",
  //   }),
  hourlyRate: z
    .number({ invalid_type_error: "Hourly rate must be a number" })
    .min(1, "Hourly rate must be at least 1 EUR")
    .max(10000, "Hourly rate seems too high"),
});

export const VENDOR_FIELD_LABELS = {
  name: "Business Name",
  firstName: "First Name",
  lastName: "Last Name",
  bio: "Description",
  services: "Type of Service",
  website: "Website",
  image: "Profile Image",
  phone: "Phone Number",
  hourlyRate: "Hourly Rate (EUR)",
};

export const SERVICE_OPTIONS = [
  { label: "On-site", value: "on-site" },
  { label: "On-line", value: "on-line" },
];
