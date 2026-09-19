import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ChoiceOption, EntryValue, JevProject, QuestionDef, QuestionType, TypedQuestion } from "../types/project";
import { DEFAULT_MODEL } from "../types/project";
import type { KeyValueStorage } from "../platform/types";
import {
  addStateChild,
  convertStateAt,
  convertStateRoot,
  moveStateAt,
  removeStateAt,
  renameStateKey,
  setStateAt,
  type NodeKind,
  type PathSeg,
  type RootKind,
} from "../statetree/ops";
import { serializeRequest } from "../schema/serialize";
import { importProject } from "../schema/import";
import type { JevRequest, JevResponse } from "../types/api";

export type StateMode = "text" | "json" | "tree";
export type QuestionTab = "builder" | "json";

/** A saved snapshot: the built project plus (optionally) its last run's result. */
export interface SavedRun {
  request: JevRequest;
  response: JevResponse;
  elapsedMs: number;
}

export interface SavedEntry {
  id: string;
  name: string;
  savedAt: number;
  project: JevProject;
  run: SavedRun | null;
}

export interface ProjectView {
  stateMode: StateMode;
  /** Plain-text buffer; equals project.state when it is a string. */
  stateText: string;
  /** JSON source buffer for the JSON mode. */
  jsonText: string;
  jsonValid: boolean;
  jsonError: string | null;
  /** Questions section tab: GUI builder or raw questions JSON. */
  questionTab: QuestionTab;
  /** Raw questions-JSON buffer (regenerated on entering the JSON tab). */
  questionJsonText: string;
  questionJsonValid: boolean;
  questionJsonError: string | null;
}

export interface ProjectData {
  project: JevProject;
  view: ProjectView;
  /** Result of the most recent run (persisted so results survive reloads). */
  lastRun: SavedRun | null;
  /** Saved build+result snapshots. */
  saved: SavedEntry[];
  /** User-renamed display names for preset templates, by template id. */
  templateNameOverrides: Record<string, string>;
  /** Preset template ids the user deleted (they are examples, so deletable). */
  hiddenTemplateIds: string[];
  /** Undo/redo availability (history lives outside the persisted state). */
  canUndo: boolean;
  canRedo: boolean;
}

export interface ProjectActions {
  setProjectName(name: string): void;
  setModel(model: string): void;
  setTextState(text: string): void;
  setJsonText(text: string): void;
  switchStateMode(target: StateMode): void;
  loadProject(project: JevProject): void;
  addQuestion(type: QuestionType): void;
  convertQuestion(id: string, type: QuestionType): void;
  updateQuestion(id: string, patch: { id?: string; instructions?: string }): void;
  removeQuestion(id: string): void;
  duplicateQuestion(id: string): void;
  moveQuestion(id: string, dir: -1 | 1): void;
  addChoiceOption(id: string): void;
  updateChoiceOption(id: string, index: number, patch: Partial<ChoiceOption>): void;
  removeChoiceOption(id: string, index: number): void;
  moveChoiceOption(id: string, index: number, dir: -1 | 1): void;
  addScoreLevel(id: string): void;
  updateScoreLevel(id: string, index: number, value: string): void;
  removeScoreLevel(id: string, index: number): void;
  moveScoreLevel(id: string, index: number, dir: -1 | 1): void;
  setNoulDesc(id: string, which: "true" | "false", value: string): void;
  setStateNodeValue(segs: PathSeg[], value: EntryValue): void;
  renameStateNodeKey(segs: PathSeg[], newKey: string): void;
  addStateChildNode(parentSegs: PathSeg[], key?: string): void;
  removeStateNode(segs: PathSeg[]): void;
  moveStateNode(segs: PathSeg[], dir: -1 | 1): void;
  convertStateNodeKind(segs: PathSeg[], kind: NodeKind): void;
  convertStateRoot(kind: RootKind): void;
  setQuestionTab(tab: QuestionTab): void;
  setQuestionJsonText(text: string): void;
  setLastRun(run: SavedRun | null): void;
  saveProject(): void;
  deleteSaved(id: string): void;
  loadSaved(id: string): void;
  renameSaved(id: string, name: string): void;
  setTemplateNameOverride(id: string, name: string): void;
  hideTemplate(id: string): void;
  undo(): void;
  redo(): void;
}

export type ProjectStore = ProjectData & ProjectActions;

export const SCORE_MIN_LEVELS = 2;
export const SCORE_MAX_LEVELS = 10;
export const CHOICE_MAX_OPTIONS = 255;

export function createEmptyProject(): JevProject {
  return { version: 1, name: "", model: DEFAULT_MODEL, state: "", questions: [] };
}

export function defaultQuestion(type: QuestionType, id: string): QuestionDef {
  if (type === "choice") {
    return {
      id,
      type,
      instructions: "",
      criteria: {
        kind: "choice",
        options: [
          { key: "option_1", description: "" },
          { key: "option_2", description: "" },
        ],
      },
    };
  }
  if (type === "score") {
    return { id, type, instructions: "", criteria: { kind: "score", levels: ["", ""] } };
  }
  return { id, type, instructions: "", criteria: { kind: "noul" } };
}

export function slugifyId(base: string): string {
  const slug = base
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "question";
}

export function uniqueId(base: string, questions: QuestionDef[]): string {
  const slug = slugifyId(base);
  const taken = new Set(questions.map((q) => q.id));
  if (!taken.has(slug)) return slug;
  let n = 2;
  while (taken.has(`${slug}_${n}`)) n++;
  return `${slug}_${n}`;
}

export function viewFromState(state: JevProject["state"], mode?: StateMode): ProjectView {
  const isText = typeof state === "string";
  return {
    stateMode: mode ?? (isText ? "text" : "json"),
    stateText: isText ? state : "",
    jsonText: isText ? "" : JSON.stringify(state, null, 2),
    jsonValid: true,
    jsonError: null,
    questionTab: "builder",
    questionJsonText: "",
    questionJsonValid: true,
    questionJsonError: null,
  };
}

function questionsJsonFor(project: JevProject): string {
  return JSON.stringify(serializeRequest(project).questions, null, 2);
}

function questionJsonBuffersFor(project: JevProject) {
  return {
    questionJsonText: questionsJsonFor(project),
    questionJsonValid: true,
    questionJsonError: null,
  };
}

function mutateState(
  set: SetFn,
  get: GetFn,
  fn: (state: JevProject["state"]) => JevProject["state"]
): void {
  const s = get();
  const next = fn(s.project.state);
  if (next === s.project.state) return;
  set({ project: { ...s.project, state: next } });
}

export function createProjectStore(storage: KeyValueStorage) {
  const past: { project: JevProject; view: ProjectView }[] = [];
  const future: { project: JevProject; view: ProjectView }[] = [];
  let restoring = false;
  let lastChangeAt = 0;

  const store = createStore<ProjectStore>()(
    persist(
      (set, get) => ({
        project: createEmptyProject(),
        view: viewFromState(""),
        lastRun: null,
        saved: [],
        templateNameOverrides: {},
        hiddenTemplateIds: [],
        canUndo: false,
        canRedo: false,

        setProjectName: (name) => set((s) => ({ project: { ...s.project, name } })),
        setModel: (model) => set((s) => ({ project: { ...s.project, model } })),

        setTextState: (text) =>
          set((s) => ({
            project: { ...s.project, state: text },
            view: { ...s.view, stateText: text, jsonValid: true, jsonError: null },
          })),

        setJsonText: (text) => {
          try {
            const parsed = JSON.parse(text) as unknown;
            if (typeof parsed === "number" || typeof parsed === "boolean" || parsed === null) {
              set((s) => ({
                view: {
                  ...s.view,
                  jsonText: text,
                  jsonValid: false,
                  jsonError: "state must be an object, an array, or a string",
                },
              }));
              return;
            }
            set((s) => ({
              project: { ...s.project, state: parsed as JevProject["state"] },
              view: { ...s.view, jsonText: text, jsonValid: true, jsonError: null },
            }));
          } catch (err) {
            set((s) => ({
              view: {
                ...s.view,
                jsonText: text,
                jsonValid: false,
                jsonError: err instanceof Error ? err.message : String(err),
              },
            }));
          }
        },

        switchStateMode: (target) => {
          const { project, view } = get();
          if (target === view.stateMode) return;
          if (target === "text") {
            const text =
              typeof project.state === "string" ? project.state : JSON.stringify(project.state, null, 2);
            set({ project: { ...project, state: text }, view: { ...view, ...viewFromState(text, "text") } });
            return;
          }
          if (target === "json") {
            let next: JevProject["state"];
            if (typeof project.state === "string") {
              const raw = project.state;
              try {
                const parsed = JSON.parse(raw) as unknown;
                next = typeof parsed === "object" && parsed !== null ? (parsed as JevProject["state"]) : { text: raw };
              } catch {
                next = { text: raw };
              }
            } else {
              next = project.state;
            }
            set({ project: { ...project, state: next }, view: { ...view, ...viewFromState(next, "json") } });
            return;
          }
          set({ view: { ...view, stateMode: "tree" } });
        },

        loadProject: (project) =>
          set((s) => ({
            project,
            lastRun: null,
            view: {
              ...s.view,
              ...viewFromState(project.state),
              ...(s.view.questionTab === "json" ? questionJsonBuffersFor(project) : {}),
            },
          })),

        addQuestion: (type) =>
          set((s) => {
            const id = uniqueId(type, s.project.questions);
            return { project: { ...s.project, questions: [...s.project.questions, defaultQuestion(type, id)] } };
          }),

        convertQuestion: (id, type) =>
          set((s) => ({
            project: {
              ...s.project,
              questions: s.project.questions.map((q) =>
                q.id === id && q.type !== type
                  ? { id: q.id, type, instructions: q.instructions, criteria: defaultQuestion(type, q.id).criteria }
                  : q
              ),
            },
          })),

        updateQuestion: (id, patch) =>
          set((s) => ({
            project: {
              ...s.project,
              questions: s.project.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
            },
          })),

        removeQuestion: (id) =>
          set((s) => ({ project: { ...s.project, questions: s.project.questions.filter((q) => q.id !== id) } })),

        duplicateQuestion: (id) =>
          set((s) => {
            const index = s.project.questions.findIndex((q) => q.id === id);
            if (index < 0) return s;
            const source = s.project.questions[index]!;
            const copy: QuestionDef = JSON.parse(JSON.stringify(source));
            copy.id = uniqueId(`${source.id}_copy`, s.project.questions);
            const questions = [...s.project.questions];
            questions.splice(index + 1, 0, copy);
            return { project: { ...s.project, questions } };
          }),

        moveQuestion: (id, dir) =>
          set((s) => {
            const questions = moveItem(s.project.questions, (q) => q.id === id, dir);
            return questions ? { project: { ...s.project, questions } } : s;
          }),

        addChoiceOption: (id) =>
          mutateQuestion(set, get, id, "choice", (q) => {
            const options = q.criteria.options;
            if (options.length >= CHOICE_MAX_OPTIONS) return q;
            const taken = new Set(options.map((o) => o.key));
            let n = options.length + 1;
            let key = `option_${n}`;
            while (taken.has(key)) key = `option_${++n}`;
            return { ...q, criteria: { kind: "choice", options: [...options, { key, description: "" }] } };
          }),

        updateChoiceOption: (id, index, patch) =>
          mutateQuestion(set, get, id, "choice", (q) => ({
            ...q,
            criteria: {
              kind: "choice",
              options: q.criteria.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
            },
          })),

        removeChoiceOption: (id, index) =>
          mutateQuestion(set, get, id, "choice", (q) => {
            if (q.criteria.options.length <= 1) return q;
            return { ...q, criteria: { kind: "choice", options: q.criteria.options.filter((_, i) => i !== index) } };
          }),

        moveChoiceOption: (id, index, dir) =>
          mutateQuestion(set, get, id, "choice", (q) => {
            const options = moveItem(q.criteria.options, (_, i) => i === index, dir);
            return options ? { ...q, criteria: { kind: "choice", options } } : q;
          }),

        addScoreLevel: (id) =>
          mutateQuestion(set, get, id, "score", (q) => {
            if (q.criteria.levels.length >= SCORE_MAX_LEVELS) return q;
            return { ...q, criteria: { kind: "score", levels: [...q.criteria.levels, ""] } };
          }),

        updateScoreLevel: (id, index, value) =>
          mutateQuestion(set, get, id, "score", (q) => ({
            ...q,
            criteria: { kind: "score", levels: q.criteria.levels.map((l, i) => (i === index ? value : l)) },
          })),

        removeScoreLevel: (id, index) =>
          mutateQuestion(set, get, id, "score", (q) => {
            if (q.criteria.levels.length <= SCORE_MIN_LEVELS) return q;
            return { ...q, criteria: { kind: "score", levels: q.criteria.levels.filter((_, i) => i !== index) } };
          }),

        moveScoreLevel: (id, index, dir) =>
          mutateQuestion(set, get, id, "score", (q) => {
            const levels = moveItem(q.criteria.levels, (_, i) => i === index, dir);
            return levels ? { ...q, criteria: { kind: "score", levels } } : q;
          }),

        setNoulDesc: (id, which, value) =>
          mutateQuestion(set, get, id, "noul", (q) => ({
            ...q,
            criteria: {
              kind: "noul",
              trueDesc: which === "true" ? value : q.criteria.trueDesc,
              falseDesc: which === "false" ? value : q.criteria.falseDesc,
            },
          })),

        setStateNodeValue: (segs, value) =>
          mutateState(set, get, (state) => setStateAt(state, segs, value)),
        renameStateNodeKey: (segs, newKey) =>
          mutateState(set, get, (state) => renameStateKey(state, segs, newKey)),
        addStateChildNode: (parentSegs, key) =>
          mutateState(set, get, (state) => addStateChild(state, parentSegs, key)),
        removeStateNode: (segs) => mutateState(set, get, (state) => removeStateAt(state, segs)),
        moveStateNode: (segs, dir) => mutateState(set, get, (state) => moveStateAt(state, segs, dir)),
        convertStateNodeKind: (segs, kind) => mutateState(set, get, (state) => convertStateAt(state, segs, kind)),
        convertStateRoot: (kind) => mutateState(set, get, (state) => convertStateRoot(state, kind)),

        setQuestionTab: (tab) => {
          const s = get();
          if (tab === s.view.questionTab) return;
          if (tab === "json") {
            set({ view: { ...s.view, questionTab: "json", ...questionJsonBuffersFor(s.project) } });
            return;
          }
          set({ view: { ...s.view, questionTab: "builder" } });
        },

        setQuestionJsonText: (text) => {
          const s = get();
          const applyParsed = (parsed: unknown) => {
            const body = { state: s.project.state, model: s.project.model, questions: parsed };
            const result = importProject(body, s.project.name || "imported");
            if (!result.ok) {
              set({
                view: {
                  ...s.view,
                  questionJsonText: text,
                  questionJsonValid: false,
                  questionJsonError: result.error,
                },
              });
              return;
            }
            set({
              project: result.project,
              view: { ...s.view, questionJsonText: text, questionJsonValid: true, questionJsonError: null },
            });
          };
          try {
            applyParsed(JSON.parse(text) as unknown);
          } catch (err) {
            set({
              view: {
                ...s.view,
                questionJsonText: text,
                questionJsonValid: false,
                questionJsonError: err instanceof Error ? err.message : String(err),
              },
            });
          }
        },

        setLastRun: (run) => set({ lastRun: run }),

        saveProject: () =>
          set((s) => {
            const id =
              typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `saved_${Date.now()}`;
            const entry: SavedEntry = {
              id,
              name: s.project.name || "untitled",
              savedAt: Date.now(),
              project: s.project,
              run: s.lastRun,
            };
            return { saved: [entry, ...s.saved].slice(0, 50) };
          }),

        deleteSaved: (id) => set((s) => ({ saved: s.saved.filter((e) => e.id !== id) })),

        loadSaved: (id) => {
          const s = get();
          const entry = s.saved.find((e) => e.id === id);
          if (!entry) return;
          set({
            project: entry.project,
            lastRun: entry.run,
            view: {
              ...s.view,
              ...viewFromState(entry.project.state),
              ...(s.view.questionTab === "json" ? questionJsonBuffersFor(entry.project) : {}),
            },
          });
        },

        renameSaved: (id, name) =>
          set((s) => ({
            saved: s.saved.map((e) => (e.id === id ? { ...e, name: name.trim() === "" ? e.name : name.trim() } : e)),
          })),

        setTemplateNameOverride: (id, name) =>
          set((s) => ({
            templateNameOverrides: { ...s.templateNameOverrides, [id]: name.trim() === "" ? s.templateNameOverrides[id] ?? "" : name.trim() },
          })),

        hideTemplate: (id) =>
          set((s) => ({
            hiddenTemplateIds: s.hiddenTemplateIds.includes(id) ? s.hiddenTemplateIds : [...s.hiddenTemplateIds, id],
          })),

        undo: () => {
          const entry = past.pop();
          if (!entry) return;
          const s = get();
          future.push({ project: s.project, view: s.view });
          restoring = true;
          set({ project: entry.project, view: entry.view, canUndo: past.length > 0, canRedo: true });
          restoring = false;
          lastChangeAt = 0;
        },

        redo: () => {
          const entry = future.pop();
          if (!entry) return;
          const s = get();
          past.push({ project: s.project, view: s.view });
          restoring = true;
          set({ project: entry.project, view: entry.view, canUndo: true, canRedo: future.length > 0 });
          restoring = false;
          lastChangeAt = 0;
        },
      }),
      {
        name: "playjev.project.v1",
        storage: createJSONStorage(() => storage),
        partialize: (s) => ({
          project: s.project,
          view: s.view,
          lastRun: s.lastRun,
          saved: s.saved,
          templateNameOverrides: s.templateNameOverrides,
          hiddenTemplateIds: s.hiddenTemplateIds,
        }),
        merge: (persisted, current) => {
          const p = persisted as Partial<ProjectData> | undefined;
          return {
            ...current,
            project: p?.project ?? current.project,
            view: p?.view ?? current.view,
            lastRun: p?.lastRun ?? null,
            saved: p?.saved ?? [],
            templateNameOverrides: p?.templateNameOverrides ?? {},
            hiddenTemplateIds: p?.hiddenTemplateIds ?? [],
          };
        },
      }
    )
  );

  /**
   * Undo/redo history: every change to `project` pushes the previous snapshot
   * (view rides along so buffers stay consistent). Consecutive changes within
   * 500ms coalesce into one entry, so typing a word undoes as a unit.
   */
  store.subscribe((s, prev) => {
    if (restoring || s.project === prev.project) return;
    const now = Date.now();
    if (!(now - lastChangeAt < 500 && past.length > 0)) {
      past.push({ project: prev.project, view: prev.view });
      if (past.length > 50) past.shift();
    }
    future.length = 0;
    lastChangeAt = now;
    if (!s.canUndo || s.canRedo) store.setState({ canUndo: true, canRedo: false });
  });

  return store;
}

type SetFn = (partial: Partial<ProjectStore> | ((s: ProjectStore) => Partial<ProjectStore>)) => void;
type GetFn = () => ProjectStore;

function mutateQuestion<K extends QuestionType>(
  set: SetFn,
  get: GetFn,
  id: string,
  type: K,
  fn: (q: Extract<TypedQuestion, { type: K }>) => QuestionDef
): void {
  const s = get();
  const index = s.project.questions.findIndex((q) => q.id === id && q.type === type);
  if (index < 0) return;
  const q = s.project.questions[index] as Extract<TypedQuestion, { type: K }>;
  const questions = [...s.project.questions];
  questions[index] = fn(q);
  set({ project: { ...s.project, questions } });
}

function moveItem<T>(arr: T[], match: (item: T, index: number) => boolean, dir: -1 | 1): T[] | null {
  const index = arr.findIndex(match);
  const target = index + dir;
  if (index < 0 || target < 0 || target >= arr.length) return null;
  const copy = [...arr];
  const [item] = copy.splice(index, 1);
  copy.splice(target, 0, item!);
  return copy;
}
