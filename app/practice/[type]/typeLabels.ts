import type { QuestionType } from "@/lib/questions/types";

/** Display names for the Reading types that can be practised so far. */
export const TYPE_LABELS: Partial<Record<QuestionType, string>> = {
  REORDER_PARAGRAPH: "Reorder Paragraph",
  FIB_RW: "R&W Fill in the Blanks",
  FIB_READING: "Reading Fill in the Blanks",
  MCS_READING: "Multiple Choice (Single)",
  MCM_READING: "Multiple Choice (Multiple)",
};
