const GRADIENTS = [
  "from-indigo-500 to-violet-500",
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-rose-500 to-orange-500",
  "from-amber-500 to-pink-500",
  "from-cyan-500 to-blue-500",
];

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h);
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const sizeMap = {
  sm: "h-9 w-9 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export function Avatar({
  name,
  size = "md",
  online,
}: {
  name: string;
  size?: keyof typeof sizeMap;
  online?: boolean;
}) {
  const gradient = GRADIENTS[hash(name) % GRADIENTS.length];
  return (
    <div className="relative shrink-0">
      <div
        className={`flex items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ${gradient} ${sizeMap[size]}`}
      >
        {initials(name) || "?"}
      </div>
      {online !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0a0a12] ${
            online ? "bg-emerald-400" : "bg-slate-600"
          }`}
        />
      )}
    </div>
  );
}
