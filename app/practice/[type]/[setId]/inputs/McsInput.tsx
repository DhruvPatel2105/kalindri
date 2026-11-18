"use client";

interface Option {
  id: string;
  text: string;
}

/**
 * MCS_READING answer input — controlled: the parent owns the response (the
 * chosen option id, "" for none). No submit button and no result display;
 * the test runner submits the whole set and shows marks on the results page.
 * `correct_option_id` is never a prop — it stays on the server.
 */
export function McsInput({
  passage,
  questionText,
  options,
  value,
  onChange,
  disabled,
}: {
  passage: string;
  questionText: string;
  options: Option[];
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded border-l-[3px] border-[#1f6f6b] bg-[#fafaf8] p-4 text-sm leading-relaxed text-[#1e2a2a]">
        {passage}
      </div>

      <p className="font-medium text-[#1e2a2a]">{questionText}</p>

      <fieldset disabled={disabled} className="flex flex-col gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            className={`flex cursor-pointer items-center gap-2 rounded border bg-white px-3 py-2 text-sm ${
              value === option.id ? "border-[#1f6f6b] bg-[#f4faf9]" : "border-[#ddd9d0]"
            }`}
          >
            <input
              type="radio"
              name="option"
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            {option.text}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
