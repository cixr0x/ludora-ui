export function ExpansionBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded border border-amber-300/40 bg-neutral-950/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200 shadow-sm backdrop-blur ${className}`}
    >
      Expansión
    </span>
  );
}
