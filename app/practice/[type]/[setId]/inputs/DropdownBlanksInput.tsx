"use client";

/**
 * FIB_RW answer input — controlled; `value` is one chosen option per blank
 * ("" = not chosen), the same shape the scorer takes. `correct_option` is
 * never a prop — only the options.
 */
export function DropdownBlanksInput({
  parts,
  blanks,
  value,
  onChange,
  disabled,
}: {
  parts: string[];
  blanks: { options: string[] }[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  function handleSelect(blankIndex: number, chosen: string) {
    const next = blanks.map((_, i) => value[i] ?? "");
    next[blankIndex] = chosen;
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-semibold leading-relaxed text-[#1e2a2a]">
        Below is a text with blanks. Click on each blank, a list of choices
        will appear. Select the appropriate answer choice for each blank.
      </p>

      <div className="rounded border-l-[3px] border-[#1f6f6b] bg-[#fafaf8] px-7 py-6">
        <p className="text-base leading-loose text-[#283634]">
          {parts.map((text, i) => {
            const blank = blanks[i];
            const chosen = value[i] ?? "";
            return (
              <span key={i}>
                {text}
                {blank ? (
                  <select
                    value={chosen}
                    disabled={disabled}
                    onChange={(e) => handleSelect(i, e.target.value)}
                    aria-label={`Blank ${i + 1}`}
                    className={`mx-1.5 inline-block cursor-pointer rounded border px-2 py-1 align-middle text-sm ${
                      chosen
                        ? "border-[#1f6f6b] bg-[#eaf2f1] font-medium text-[#173534]"
                        : "border-[#a9c4c1] bg-white text-[#7d8a88]"
                    }`}
                  >
                    <option value="">— select —</option>
                    {blank.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : null}
              </span>
            );
          })}
        </p>
      </div>

      <p className="text-xs text-[#7d8a88]">
        One mark per blank. Read the whole sentence before choosing — several
        options fit the grammar but not the meaning.
      </p>
    </div>
  );
}
