"use server";

/**
 * Records a Practice "Answer" press. The answer itself is already on screen —
 * the page prefetched it — so this runs in the background: it authenticates,
 * re-checks the set and question, saves the attempt and marks it on the
 * server (the record of truth). It returns only the server's marking and the
 * attempt count, never question content.
 */

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";

import { answerLearnQuestion } from "./learnEngine";
import type { QuestionResultKind } from "./testResults";

export type AnswerResult =
  | { ok: true; kind: QuestionResultKind; attemptNumber: number }
  | { ok: false; error: string };

export async function answerQuestionAction(input: {
  type: string;
  setId: string;
  questionId: string;
  response: unknown;
}): Promise<AnswerResult> {
  const user = await requireActiveSession();
  if (!(QUESTION_TYPES as readonly string[]).includes(input.type)) {
    return { ok: false, error: "Unknown question type." };
  }
  try {
    const { review, attemptNumber } = await answerLearnQuestion(user, {
      type: input.type as QuestionType,
      setId: input.setId,
      questionId: input.questionId,
      response: input.response,
    });
    return { ok: true, kind: review.kind, attemptNumber };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't check your answer." };
  }
}
