import type { ReactNode } from "react";

export function BearFace({
  filter,
  accessory,
  backdrop,
  squish,
  size,
}: {
  filter: string;
  accessory: string;
  backdrop: string;
  squish?: boolean;
  size?: number;
}) {
  return (
    <div className={squish ? "bear squish" : size ? "bear quiet" : "bear"} style={size ? { width: size } : undefined}>
      <div className={`back back-${backdrop === "none" ? "glow" : backdrop}`} />
      <img src="/bear.png" alt="" style={{ filter: [filter, "drop-shadow(0 14px 0 rgba(0,0,0,.16))"].filter(Boolean).join(" ") }} />
      {size ? null : <><span className="lid l" /><span className="lid r" /></>}
      <Accessory kind={accessory} />
    </div>
  );
}

function Accessory({ kind }: { kind: string }) {
  if (!kind || kind === "none") return null;
  const common = { className: "acc", width: 78, height: 48, viewBox: "0 0 78 48" };
  const map: Record<string, ReactNode> = {
    bow: <path d="M20 24c-8-10-18-8-18 2s10 12 18 2 8-10 18-2-18 8-18 2 10-12 18-2-8-10-18-2z" fill="#e07a9a" />,
    crown: <path d="M10 32 18 14l12 12L39 8l10 18 11-12 8 18z" fill="#f0c14d" stroke="#8a5a12" />,
    scarf: <path d="M14 20h50c4 10-2 18-12 18H26C16 38 10 30 14 20z" fill="#d4543c" />,
    glasses: <g fill="none" stroke="#2b241c" strokeWidth="3"><circle cx="24" cy="24" r="10" /><circle cx="52" cy="24" r="10" /><path d="M34 24h8" /></g>,
    halo: <ellipse cx="39" cy="10" rx="16" ry="6" fill="none" stroke="#ffe08a" strokeWidth="4" />,
    star: <path d="M39 4l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z" fill="#ffe08a" />,
    flower: <g fill="#f08ab0"><circle cx="39" cy="16" r="5" fill="#ffe08a" /><circle cx="28" cy="16" r="6" /><circle cx="50" cy="16" r="6" /><circle cx="33" cy="8" r="6" /><circle cx="45" cy="8" r="6" /></g>,
    moon: <path d="M42 6a16 16 0 1 0 0 28 12 12 0 1 1 0-28z" fill="#f4e2b0" />,
    honey: <ellipse cx="39" cy="18" rx="14" ry="10" fill="#e7a85a" stroke="#8a4e22" />,
    cape: <path d="M18 16c8 20 34 20 42 0-8 26-34 26-42 0z" fill="#8d2f3a" />,
    bell: <path d="M39 8v6a12 12 0 0 1 12 12H27A12 12 0 0 1 39 14z" fill="#f0c14d" />,
    leaf: <path d="M20 30c16-22 36-18 40-4-18 2-30 8-40 4z" fill="#3f8f4a" />,
    heart: <path d="M39 34 22 20a8 8 0 0 1 12-10l5 5 5-5a8 8 0 0 1 12 10z" fill="#e15b78" />,
    patch: <rect x="22" y="14" width="22" height="16" rx="3" fill="#c98448" stroke="#5c3a22" />,
    hood: <path d="M14 28c6-18 44-18 50 0-8-8-42-8-50 0z" fill="#5c4638" />,
  };
  const body = map[kind];
  if (!body) return null;
  const style =
    kind === "crown" || kind === "halo" || kind === "flower" || kind === "star" || kind === "moon"
      ? { top: "2%", left: "50%", transform: "translateX(-50%)" }
      : kind === "bow"
        ? { top: "18%", left: "8%" }
        : { bottom: "18%", left: "50%", transform: "translateX(-50%)" };
  return (
    <svg {...common} style={style} aria-hidden="true">
      {body}
    </svg>
  );
}
