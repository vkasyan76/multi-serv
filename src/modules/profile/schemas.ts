import z from "zod";
import { Language } from "@googlemaps/google-maps-services-js";

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
  language: z.nativeEnum(Language),
});

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
  category: z.string().min(1, "Please select a category"),
  website: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^https?:\/\//.test(val) || /^www\./.test(val), // or use a more advanced URL check
      { message: "Website must be a valid URL." }
    ),
  image: z.string().optional(),
});

export const VENDOR_FIELD_LABELS = {
  name: "Business Name",
  firstName: "First Name",
  lastName: "Last Name",
  bio: "Description",
  services: "Type of Service",
  website: "Website",
  image: "Profile Image",
};

// Checkbox choices
export const SERVICE_OPTIONS = [
  { label: "On-site", value: "on-site" },
  { label: "On-line", value: "on-line" },
] as const;
