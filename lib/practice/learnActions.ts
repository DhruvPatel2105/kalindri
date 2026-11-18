"use server";

/**
 * The Practice "Answer" button. A public endpoint, so it authenticates and
 * hands the user to learnEngine, which re-checks the set and question. It
 * reveals ONE question's answer per call (the answer is not in the page).
 */

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";

import { answerLearnQuestion } from "./learnEngine";
import type { QuestionReview } from "./reviewModel";

export type AnswerResult =
  | { ok: true; review: QuestionReview; attemptNumber: number }
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
    return { ok: true, review, attemptNumber };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't check your answer." };
  }
}
