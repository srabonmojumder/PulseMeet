import { Activity } from "lucide-react";

const sizes = {
  sm: { box: "h-8 w-8 rounded-lg", icon: 18, text: "text-base" },
  md: { box: "h-10 w-10 rounded-xl", icon: 22, text: "text-lg" },
  lg: { box: "h-14 w-14 rounded-2xl", icon: 30, text: "text-2xl" },
};

export function LogoMark({ size = "md" }: { size?: keyof typeof sizes }) {
  const s = sizes[size];
  return (
    <div
      className={`brand-gradient flex shrink-0 items-center justify-center text-white shadow-lg shadow-indigo-500/30 ${s.box}`}
    >
      <Activity size={s.icon} strokeWidth={2.5} />
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
