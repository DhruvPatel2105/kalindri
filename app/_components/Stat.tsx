/** One labelled figure on a dashboard card: label, value, optional hint underneath. */
export function Stat({
  label,
  value,
  hint,
  tone = "text-[#1e2a2a]",
  size = "md",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** Text colour class for the value (e.g. green for "correct"). */
  tone?: string;
  /** "lg" for the headline cards on the home page. */
  size?: "md" | "lg";
}) {
  return (
    <div
      className={`border border-[#ddd9d0] bg-white ${
        size === "lg" ? "rounded px-4 py-3" : "rounded-lg px-3 py-2.5"
      }`}
    >
      <p className="text-xs text-[#7d8a88]">{label}</p>
      <p className={`mt-0.5 font-semibold ${size === "lg" ? "text-xl" : "text-lg"} ${tone}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-[#9aa39f]">{hint}</p> : null}
    </div>
  );
}
