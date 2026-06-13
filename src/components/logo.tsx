const sizes = {
  sm: { box: "h-8 w-8 rounded-lg text-base", text: "text-base" },
  md: { box: "h-10 w-10 rounded-xl text-lg", text: "text-lg" },
  lg: { box: "h-14 w-14 rounded-2xl text-2xl", text: "text-2xl" },
};

export function LogoMark({ size = "md" }: { size?: keyof typeof sizes }) {
  const s = sizes[size];
  return (
    <div
      className={`brand-gradient flex shrink-0 items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30 ${s.box}`}
    >
      P
    </div>
  );
}

export function Logo({
  size = "md",
  withWordmark = true,
}: {
  size?: keyof typeof sizes;
  withWordmark?: boolean;
}) {
  const s = sizes[size];
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      {withWordmark && (
        <span className={`font-semibold tracking-tight text-white ${s.text}`}>
          Pulse<span className="brand-text">Meet</span>
        </span>
      )}
    </div>
  );
}
