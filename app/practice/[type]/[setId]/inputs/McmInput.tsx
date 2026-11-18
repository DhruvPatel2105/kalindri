"use client";

interface Option {
  id: string;
  text: string;
}

/**
 * MCM_READING answer input — controlled; `value` is the selected option ids.
 * `correct_option_ids` is never a prop — it stays on the server.
 */
export function McmInput({
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
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(id: string) {
    onChange(
      value.includes(id) ? value.filter((existing) => existing !== id) : [...value, id],
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded border-l-[3px] border-[#1f6f6b] bg-[#fafaf8] p-4 text-sm leading-relaxed text-[#1e2a2a]">
        {passage}
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-medium text-[#1e2a2a]">{questionText}</p>
        <p className="text-xs text-[#7d8a88]">
          Select all that apply. Incorrect selections subtract marks.
        </p>
      </div>

      <fieldset disabled={disabled} className="flex flex-col gap-2">
        {options.map((option) => {
          const selected = value.includes(option.id);
          return (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-2 rounded border bg-white px-3 py-2 text-sm ${
                selected ? "border-[#1f6f6b] bg-[#f4faf9]" : "border-[#ddd9d0]"
              }`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggle(option.id)}
              />
              {option.text}
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}
