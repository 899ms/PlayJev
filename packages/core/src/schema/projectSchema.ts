import { z } from "zod";
import type { JevProject, QuestionDef } from "../types/project";
import { entryValueSchema } from "./entry";

const choiceOptionSchema = z.object({
  key: z.string(),
  description: entryValueSchema,
});

export const questionDefSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("choice"),
    instructions: entryValueSchema,
    criteria: z.object({ kind: z.literal("choice"), options: z.array(choiceOptionSchema) }),
  }),
  z.object({
    id: z.string(),
    type: z.literal("score"),
    instructions: entryValueSchema,
    criteria: z.object({ kind: z.literal("score"), levels: z.array(entryValueSchema) }),
  }),
  z.object({
    id: z.string(),
    type: z.literal("noul"),
    instructions: entryValueSchema,
    criteria: z.object({
      kind: z.literal("noul"),
      trueDesc: entryValueSchema.optional(),
      falseDesc: entryValueSchema.optional(),
    }),
  }),
]);

export const jevProjectSchema = z.object({
  version: z.literal(1),
  name: z.string(),
  model: z.string().min(1),
  state: z.union([z.string(), entryValueSchema]),
  questions: z.array(questionDefSchema),
});

/** Validate an PlayJev project file. Returns a typed project or throws a ZodError. */
export function parseProjectFile(data: unknown): JevProject {
  return jevProjectSchema.parse(data) as unknown as JevProject;
}

export function isQuestionDef(value: unknown): value is QuestionDef {
  return questionDefSchema.safeParse(value).success;
}
