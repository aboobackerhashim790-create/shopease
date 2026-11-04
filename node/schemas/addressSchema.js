import { z } from "zod";

const requiredText = (label, maxLength) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength, `${label} must be ${maxLength} characters or fewer.`);

const addressSchema = z.object({
  label: z
    .string()
    .trim()
    .max(30, "Address label must be 30 characters or fewer.")
    .optional()
    .default("Home")
    .transform((label) => label || "Home"),
  fullName: requiredText("Recipient name", 100),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."),
  addressLine1: requiredText("Address line 1", 160),
  addressLine2: z
    .string()
    .trim()
    .max(160, "Address line 2 must be 160 characters or fewer.")
    .optional()
    .default(""),
  city: requiredText("City", 80),
  state: requiredText("State", 80),
  postalCode: requiredText("Postal code", 20),
  country: requiredText("Country", 80),
  isDefault: z.boolean().optional().default(false),
});

export default addressSchema;
