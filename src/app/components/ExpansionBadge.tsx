export function ExpansionBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center border border-amber-300/40 bg-neutral-950/85 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-200 shadow-sm backdrop-blur ${className}`}
    >
      Expansión
    </span>
  );
}
