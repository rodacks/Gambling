import { Crosshair, MousePointer2, Zap } from "lucide-react";
import { PlayingCard } from "./shared";
export function Car({ color = "#edc777" }: { color?: string }) {
  return (
    <svg
      viewBox="0 0 140 54"
      role="img"
      aria-label="Coche de carreras"
      className="car-svg"
    >
      <defs>
        <linearGradient id={`car-${color.replace("#", "")}`} x2="0" y2="1">
          <stop stopColor={color} />
          <stop offset="1" stopColor="#171a22" />
        </linearGradient>
      </defs>
      <ellipse cx="70" cy="46" rx="61" ry="5" fill="#000" opacity=".4" />
      <path
        d="M9 26L35 22 51 7 91 7 107 23 130 27 136 39 6 39Z"
        fill={`url(#car-${color.replace("#", "")})`}
        stroke={color}
        strokeWidth="2"
      />
      <path d="M43 22L55 10H86L98 22Z" fill="#10151d" />
      <path d="M68 10V22" stroke={color} strokeWidth="3" />
      <rect x="111" y="27" width="19" height="5" rx="2" fill="#fff6d0" />
      <rect x="9" y="28" width="9" height="5" fill="#fa6576" />
      <circle
        cx="34"
        cy="38"
        r="11"
        fill="#08090d"
        stroke="#555864"
        strokeWidth="3"
      />
      <circle
        cx="108"
        cy="38"
        r="11"
        fill="#08090d"
        stroke="#555864"
        strokeWidth="3"
      />
      <circle cx="34" cy="38" r="4" fill={color} />
      <circle cx="108" cy="38" r="4" fill={color} />
      <path d="M52 30H85" stroke={color} strokeWidth="3" />
    </svg>
  );
}
export function CardsArt() {
  return (
    <div className="cards-art" aria-hidden="true">
      <div className="art-card back">
        <PlayingCard card={{ rank: 13, suit: "♥" }} />
      </div>
      <div className="art-card front">
        <PlayingCard card={{ rank: 1, suit: "♠" }} />
      </div>
      <div className="chip chip-one">G</div>
      <div className="chip chip-two">G</div>
      <div className="chip chip-three">G</div>
    </div>
  );
}
export function WheelArt() {
  return (
    <div className="wheel-art" aria-hidden="true">
      <div className="wheel-art-inner">
        <span>G</span>
      </div>
      <i />
    </div>
  );
}
export function SkillArt({
  kind,
}: {
  kind: "jitter" | "reaction" | "precision";
}) {
  const Icon =
    kind === "jitter" ? MousePointer2 : kind === "reaction" ? Zap : Crosshair;
  return (
    <div className={`skill-art ${kind}`} aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <Icon size={58} strokeWidth={1.3} />
      <i />
      <b />
    </div>
  );
}
