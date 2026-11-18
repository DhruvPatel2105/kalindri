/**
 * The question types as the navigation menu lists them: by section of the
 * test, each type exactly ONCE (a task that counts toward two skills, like
 * Read Aloud, appears only where it is sat). The labels follow the test's own
 * wording. Personal Introduction is part of the Speaking section but is not
 * scored and is not one of the 19 question types, so it has no `type` and no
 * page.
 */

import type { QuestionType } from "./types";

export interface NavItem {
  label: string;
  /** The question type it opens; absent for items with no practice page. */
  type?: QuestionType;
}

export interface NavSection {
  title: string;
  items: readonly NavItem[];
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: "Speaking",
    items: [
      { label: "Personal Introduction (unscored)" },
      { label: "Read Aloud", type: "READ_ALOUD" },
      { label: "Repeat Sentence", type: "REPEAT_SENTENCE" },
      { label: "Describe Image", type: "DESCRIBE_IMAGE" },
      { label: "Respond to a Situation", type: "RESPOND_TO_SITUATION" },
      { label: "Answer Short Question", type: "ANSWER_SHORT_QUESTION" },
    ],
  },
  {
    title: "Writing",
    items: [
      { label: "Summarize Written Text", type: "SUMMARIZE_WRITTEN_TEXT" },
      { label: "Write Email", type: "WRITE_EMAIL" },
    ],
  },
  {
    title: "Reading",
    items: [
      { label: "Reading & Writing: Fill in the Blanks", type: "FIB_RW" },
      { label: "Multiple Choice, Multiple Answers", type: "MCM_READING" },
      { label: "Reorder Paragraph", type: "REORDER_PARAGRAPH" },
      { label: "Fill in the Blanks", type: "FIB_READING" },
      { label: "Multiple Choice, Single Answer", type: "MCS_READING" },
    ],
  },
  {
    title: "Listening",
    items: [
      { label: "Summarize Spoken Text", type: "SUMMARIZE_SPOKEN_TEXT" },
      { label: "Multiple Choice, Multiple Answers", type: "MCM_LISTENING" },
      { label: "Fill in the Blanks", type: "FIB_LISTENING" },
      { label: "Multiple Choice, Single Answer", type: "MCS_LISTENING" },
      { label: "Select Missing Word", type: "SELECT_MISSING_WORD" },
      { label: "Highlight Incorrect Words", type: "HIGHLIGHT_INCORRECT_WORDS" },
      { label: "Write from Dictation", type: "WRITE_FROM_DICTATION" },
    ],
  },
];
