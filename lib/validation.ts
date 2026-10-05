import { z } from "zod";

// Limits match the maxlength attributes of the original artifact form.
export const vendorInput = z.object({
  groupKey: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
  service: z.string().trim().min(1).max(300),
  location: z.string().trim().max(120).default(""),
  contact: z.string().trim().max(200).default(""),
  recommendedBy: z.string().trim().max(120).default(""),
  sentiment: z.enum(["positive", "mixed", "negative"]).default("positive"),
  quote: z.string().trim().max(400).default(""),
});
export type VendorInput = z.infer<typeof vendorInput>;
