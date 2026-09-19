import { z } from "zod";
import type { EntryValue } from "../types/project";

/**
 * Recursive EntryValue schema (docs/jev/primitives/advanced.md):
 * string | array | object | null, arbitrarily nested.
 * Cast keeps the output type exact; inference is irrelevant because core
 * types are declared by hand.
 */
export const entryValueSchema: z.ZodType<EntryValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(entryValueSchema),
    z.record(z.string(), entryValueSchema),
    z.null(),
  ])
) as z.ZodType<EntryValue>;

export const entryValueTextSchema: z.ZodType<string | EntryValue> = entryValueSchema as z.ZodType<string | EntryValue>;
