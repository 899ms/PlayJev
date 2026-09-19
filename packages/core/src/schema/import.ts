import { z } from "zod";
import type { EntryValue, JevProject, QuestionDef } from "../types/project";
import { DEFAULT_MODEL } from "../types/project";
import { entryValueSchema } from "./entry";
import { jevProjectSchema } from "./projectSchema";

/**
 * Two import formats:
 * 1. PlayJev project file ({ version: 1, name, model, state, questions: QuestionDef[] })
 * 2. Raw API request body ({ state, model, questions: map<string, QuestionPayload> })
 * The raw body is what users copy out of examples — accepting it makes every
 * docs/jev snippet directly importable.
 */
export type ImportResult = { ok: true; project: JevProject } | { ok: false; error: string };

type RawQuestion =
  | { type: "choice"; instructions: EntryValue; criteria: Record<string, EntryValue> }
  | { type: "score"; instructions: EntryValue; criteria: EntryValue[] }
  | { type: "noul"; instructions: EntryValue; criteria?: { true?: EntryValue; false?: EntryValue } };

interface RawRequest {
  state: string | EntryValue;
  model?: string;
  questions: Record<string, RawQuestion>;
}

export function importProject(data: unknown, fallbackName = "imported"): ImportResult {
  // Format 1: project file
  const asProject = jevProjectSchema.safeParse(data);
  if (asProject.success) {
    return { ok: true, project: asProject.data as unknown as JevProject };
  }

  // Format 2: raw API request body
  const asRaw = rawRequestSchema.safeParse(data);
  if (asRaw.success) {
    const raw = asRaw.data as unknown as RawRequest;
    const questions: QuestionDef[] = [];
    for (const [id, q] of Object.entries(raw.questions)) {
      if (q.type === "choice") {
        questions.push({
          id,
          type: "choice",
          instructions: q.instructions,
          criteria: {
            kind: "choice",
            options: Object.entries(q.criteria).map(([key, description]) => ({ key, description })),
          },
        });
      } else if (q.type === "score") {
        questions.push({
          id,
          type: "score",
          instructions: q.instructions,
          criteria: { kind: "score", levels: q.criteria },
        });
      } else {
        questions.push({
          id,
          type: "noul",
          instructions: q.instructions,
          criteria: { kind: "noul", trueDesc: q.criteria?.true, falseDesc: q.criteria?.false },
        });
      }
    }
    const rawName = (data as { name?: unknown } | null)?.name;
    return {
      ok: true,
      project: {
        version: 1,
        name: typeof rawName === "string" ? rawName : fallbackName,
        model: raw.model || DEFAULT_MODEL,
        state: raw.state,
        questions,
      },
    };
  }

  return { ok: false, error: formatZodError(asProject.error, asRaw.error) };
}

const rawRequestSchema = z.object({
  state: z.union([z.string(), entryValueSchema]),
  model: z.string().optional(),
  questions: z.record(
    z.string(),
    z.union([
      z.object({
        type: z.literal("choice"),
        instructions: entryValueSchema,
        criteria: z.record(z.string(), entryValueSchema),
      }),
      z.object({
        type: z.literal("score"),
        instructions: entryValueSchema,
        criteria: z.array(entryValueSchema).min(2),
      }),
      z.object({
        type: z.literal("noul"),
        instructions: entryValueSchema,
        criteria: z
          .object({ true: entryValueSchema.optional(), false: entryValueSchema.optional() })
          .optional(),
      }),
    ])
  ),
});

function formatZodError(projectErr: z.ZodError | undefined, rawErr: z.ZodError | undefined): string {
  const first = rawErr?.errors[0] ?? projectErr?.errors[0];
  if (!first) return "Unrecognized file format";
  const path = first.path.join(".");
  return path ? `${path}: ${first.message}` : first.message;
}
