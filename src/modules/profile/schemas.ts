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
