/**
 * DESCRIBE_IMAGE — docs/01-question-types.md §3.
 */

import { z } from "zod";

export const imageTypeSchema = z.enum([
  "bar",
  "line",
  "pie",
  "table",
  "map",
  "process",
  "photo",
]);

export const describeImageSchema = z.object({
  image_url: z.string().url(),
  image_type: imageTypeSchema,
  key_points: z.array(z.string().min(1)).min(1),
  model_answer: z.string().min(1),
  prep_seconds: z.number().int().positive().default(25),
  record_seconds: z.number().int().positive().default(40),
});

export type DescribeImagePayload = z.infer<typeof describeImageSchema>;
