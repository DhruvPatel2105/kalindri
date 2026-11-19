"use client";

import type { ClientQuestion } from "@/lib/practice/clientQuestion";

import { DropdownBlanksInput } from "./DropdownBlanksInput";
import { McmInput } from "./McmInput";
import { McsInput } from "./McsInput";
import { ReorderInput } from "./ReorderInput";
import { WordBankInput } from "./WordBankInput";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/**
 * The answer input for any question type that can be practised: picks the
 * right component and turns the stored response (unknown JSON) into the value
 * that component expects. Shared by the Test runner and Practice so both
 * render a question the same way. Keyed by question id, so per-question
 * state (like an in-progress drag) never leaks into the next question.
 */
export function QuestionInput({
  question,
  value,
  onChange,
  disabled,
}: {
  question: ClientQuestion;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
}) {
  switch (question.kind) {
    case "MCS_READING":
      return (
        <McsInput
          key={question.id}
          disabled={disabled}
          passage={question.passage}
          questionText={question.questionText}
          options={question.options}
          value={asString(value)}
          onChange={onChange}
        />
      );
    case "MCM_READING":
      return (
        <McmInput
          key={question.id}
          disabled={disabled}
          passage={question.passage}
          questionText={question.questionText}
          options={question.options}
          value={asStrings(value)}
          onChange={onChange}
        />
      );
    case "REORDER_PARAGRAPH":
      return (
        <ReorderInput
          key={question.id}
          disabled={disabled}
          boxes={question.boxes}
          value={asStrings(value)}
          onChange={onChange}
        />
      );
    case "FIB_READING":
      return (
        <WordBankInput
          key={question.id}
          disabled={disabled}
          parts={question.parts}
          wordBank={question.wordBank}
          value={asStrings(value)}
          onChange={onChange}
        />
      );
    case "FIB_RW":
      return (
        <DropdownBlanksInput
          key={question.id}
          disabled={disabled}
          parts={question.parts}
          blanks={question.blanks}
          value={asStrings(value)}
          onChange={onChange}
        />
      );
    default:
      return <p className="text-sm text-[#5c6a68]">No practice UI is built for this question type yet.</p>;
  }
}
