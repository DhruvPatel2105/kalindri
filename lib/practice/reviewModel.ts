/**
 * Pure model for the post-submission answer review: for one question, what
 * the student answered next to what was right, and which parts were right.
 * No DB access; the page renders this, nothing here decides colours.
 *
 * The review is the ONLY place answer keys are shown, and only for a test
 * that has been submitted (testEngine.getReviewQuestion enforces that) — CLAUDE.md:
 * never show model answers before the student has attempted.
 *
 * Right/wrong per blank comes from the scorer's own result (`words[].correct`)
 * rather than a second comparison here, so what's highlighted can never
 * disagree with the marks — e.g. the scorer ignores case and edge
 * punctuation when comparing words.
 */

import { questionSchemas } from "@/lib/questions/schemas";
import { scoreDeterministic } from "@/lib/scoring/registry";

import {
  computeReorderPairBreakdown,
  type PairBreakdownEntry,
} from "./reorderPairBreakdown";
import { resultKind, type QuestionResultKind } from "./testResults";
import { isAnswered, type QuestionSnapshot } from "./testState";

interface Common {
  answered: boolean;
  /** Marks earned (0 when unanswered). */
  score: number;
  maxScore: number;
  kind: QuestionResultKind;
}

export interface ReviewOption {
  id: string;
  text: string;
  /** The student picked it. */
  selected: boolean;
  /** It is (one of) the right answer(s). */
  correct: boolean;
}

export interface ReviewBlank {
  /** What the student chose or placed; "" if they left it empty. */
  submitted: string;
  expected: string;
  correct: boolean;
}

export interface ReviewPosition {
  position: number;
  /** The student's sentence at this position; "" if they placed none there. */
  submitted: string;
  expected: string;
  correct: boolean;
}

export type QuestionReview =
  | (Common & {
      type: "MCS_READING";
      passage: string;
      questionText: string;
      options: ReviewOption[];
    })
  | (Common & {
      type: "MCM_READING";
      passage: string;
      questionText: string;
      options: ReviewOption[];
      correctCount: number;
      incorrectCount: number;
    })
  | (Common & {
      type: "FIB_RW" | "FIB_READING";
      parts: string[];
      blanks: ReviewBlank[];
    })
  | (Common & {
      type: "REORDER_PARAGRAPH";
      positions: ReviewPosition[];
      pairs: PairBreakdownEntry[];
    })
  | (Common & { type: "UNSUPPORTED"; reviewType: string });

const GAP = /\{\{\d+\}\}/;

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * `response` is the student's stored response, or undefined/null if they
 * never answered. Throws if the snapshot payload doesn't match its type's
 * schema (it was validated when authored, so that means corrupt data).
 */
export function buildQuestionReview(
  snapshot: QuestionSnapshot,
  response: unknown,
): QuestionReview {
  const answered = isAnswered(response);

  switch (snapshot.type) {
    case "MCS_READING": {
      const p = questionSchemas.MCS_READING.parse(snapshot.payload);
      const chosen = typeof response === "string" ? response : "";
      const marks = scoreDeterministic(snapshot.type, p, chosen);
      return {
        type: snapshot.type,
        ...common(answered, marks),
        passage: p.passage,
        questionText: p.question,
        options: p.options.map((o) => ({
          id: o.id,
          text: o.text,
          selected: o.id === chosen,
          correct: o.id === p.correct_option_id,
        })),
      };
    }

    case "MCM_READING": {
      const p = questionSchemas.MCM_READING.parse(snapshot.payload);
      const chosen = asStrings(response);
      const marks = scoreDeterministic(snapshot.type, p, chosen);
      return {
        type: snapshot.type,
        ...common(answered, marks),
        passage: p.passage,
        questionText: p.question,
        options: p.options.map((o) => ({
          id: o.id,
          text: o.text,
          selected: chosen.includes(o.id),
          correct: p.correct_option_ids.includes(o.id),
        })),
        correctCount: "correctCount" in marks ? marks.correctCount : 0,
        incorrectCount: "incorrectCount" in marks ? marks.incorrectCount : 0,
      };
    }

    case "FIB_RW": {
      const p = questionSchemas.FIB_RW.parse(snapshot.payload);
      const marks = scoreDeterministic(snapshot.type, p, asStrings(response));
      return {
        type: snapshot.type,
        ...common(answered, marks),
        parts: p.passage_with_blanks.split(GAP),
        blanks: blanksOf(marks),
      };
    }

    case "FIB_READING": {
      const p = questionSchemas.FIB_READING.parse(snapshot.payload);
      const marks = scoreDeterministic(snapshot.type, p, asStrings(response));
      return {
        type: snapshot.type,
        ...common(answered, marks),
        parts: p.passage_with_blanks.split(GAP),
        blanks: blanksOf(marks),
      };
    }

    case "REORDER_PARAGRAPH": {
      const p = questionSchemas.REORDER_PARAGRAPH.parse(snapshot.payload);
      const student = asStrings(response);
      const marks = scoreDeterministic(snapshot.type, p, student);
      return {
        type: snapshot.type,
        ...common(answered, marks),
        positions: p.boxes.map((expected, i) => {
          const submitted = student[i] ?? "";
          return { position: i + 1, submitted, expected, correct: submitted === expected };
        }),
        pairs: computeReorderPairBreakdown(p.boxes, student),
      };
    }

    default:
      return {
        type: "UNSUPPORTED",
        reviewType: snapshot.type,
        answered,
        score: 0,
        maxScore: 0,
        kind: answered ? "incorrect" : "unanswered",
      };
  }
}

function common(
  answered: boolean,
  marks: { score: number; maxScore: number },
): Common {
  const score = answered ? marks.score : 0;
  return {
    answered,
    score,
    maxScore: marks.maxScore,
    // resultKind only returns null for an answered question with unknown marks; here both are known.
    kind: resultKind({ answered, score, maxScore: marks.maxScore }) ?? "incorrect",
  };
}

function blanksOf(marks: unknown): ReviewBlank[] {
  const words =
    marks && typeof marks === "object" && "words" in marks
      ? (marks as { words: ReviewBlank[] }).words
      : [];
  return words.map((w) => ({
    submitted: w.submitted,
    expected: w.expected,
    correct: w.correct,
  }));
}
