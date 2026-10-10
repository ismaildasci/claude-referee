// Static rules for pack questions, after TypeSafe's guidance: one idea per question, defined categories, no counting or date arithmetic.
// Findings are advice (warn) or defects (error); the --recorded rule flags a Noul that scores high on every recorded input.

export interface Finding {
  readonly rule: string;
  readonly severity: "error" | "warn";
  readonly question: string;
  readonly message: string;
}

interface Raw {
  type?: unknown;
  instructions?: { question?: unknown; note?: unknown };
  criteria?: unknown;
}

const OTHER = /^(?:other|none|neither|unknown|unsure|undecided|says_nothing|no_answer)$/i;
const COUNTING = /\b(?:how many|count (?:the|how)|counting|number of|sum of|total of|average|earlier than|later than|older than|newer than|days between)\b/i;
const NEGATED_TRUE = /^\s*(?:no|not|never|none)\b/i;
const COLOR_VALUE = /#[0-9a-f]{6}\b|\brgba?\(|\b0x[0-9a-f]{2,}\b/i;
const COMPOUND = /\b(?:and|or|ve|veya)\b/i;

export function lintQuestions(questions: Readonly<Record<string, unknown>>, model: unknown): Finding[] {
  const out: Finding[] = [];
  const add = (rule: string, severity: Finding["severity"], question: string, message: string) => out.push({ rule, severity, question, message });
  if (typeof model !== "string" || !model.trim() || /latest/i.test(model)) add("model", "warn", "(pack)", "pack.json should pin a model such as jev-1.13.0, not leave it open or use a latest alias.");
  for (const [id, q] of Object.entries(questions)) {
    const raw = q as Raw;
    const text = raw.instructions?.question;
    if (typeof text !== "string" || !text.trim()) {
      add("instructions", "error", id, "The question has no instructions.question text.");
      continue;
    }
    const type = raw.type;
    if (type === "noul") {
      if (COMPOUND.test(text)) add("compound", "warn", id, "The question contains and/or: split it so each Noul asks one thing.");
      const c = raw.criteria as { true?: unknown; false?: unknown } | undefined;
      if (typeof c?.true !== "string" || typeof c?.false !== "string") add("criteria", "error", id, "A Noul needs true and false criteria.");
      else if (NEGATED_TRUE.test(c.true)) add("negated_true", "warn", id, "The true criterion starts with a negation, so true means no; phrase the question so true is the yes case.");
      else if (c.true.trim() === c.false.trim() || c.true.includes(c.false) || c.false.includes(c.true)) add("contradiction", "warn", id, "The true and false criteria are the same or one contains the other; state what separates them.");
    }
    if (type === "choice" && raw.criteria && typeof raw.criteria === "object" && !Array.isArray(raw.criteria)) {
      const entries = Object.entries(raw.criteria as Record<string, unknown>);
      if (entries.length > 255) add("options", "error", id, "A Choice takes at most 255 options.");
      if (entries.length > 0) {
        if (!entries.some(([name]) => OTHER.test(name))) add("other", "warn", id, "A Choice should have an other or none option, so a model with no good fit has somewhere to go.");
        for (const [name, def] of entries) if (typeof def !== "string" || def.trim().length < 8 || def.trim() === name) add("definition", "warn", id, `Category ${name} has no definition in criteria; without one the model uses its own.`);
      }
    }
    if (type === "score") {
      const levels = raw.criteria;
      if (!Array.isArray(levels) || levels.length < 2 || levels.length > 10) add("levels", "error", id, "A Score needs 2 to 10 levels.");
      else if (levels.some((l) => typeof l !== "string" || !l.trim() || /^[\d.\s]+$/.test(l))) add("levels", "warn", id, "Every Score level needs a description, not only a number.");
    }
    if (COLOR_VALUE.test(text)) add("numeric_value", "warn", id, "Hex, RGB and similar numeric values read poorly; convert in code and pass a named bucket.");
    if (COUNTING.test(text)) add("counting", "warn", id, "Counting, summing and date comparison belong in code, not in a question to Jev.");
  }
  return out;
}

export function lintRecorded(noulByKey: Readonly<Record<string, readonly number[]>>, minCount = 10): Finding[] {
  const out: Finding[] = [];
  for (const [key, values] of Object.entries(noulByKey)) {
    if (values.length < minCount) continue;
    const sorted = [...values].sort((a, b) => a - b);
    const p10 = sorted[Math.floor(sorted.length * 0.1)] as number;
    if (p10 >= 0.5) out.push({ rule: "recorded", severity: "warn", question: key, message: `The 10th percentile of ${values.length} recorded answers is ${p10.toFixed(2)}: this question scores high on every input and can't act as a gate.` });
  }
  return out;
}
