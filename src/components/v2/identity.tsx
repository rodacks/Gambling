"use client";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { AVATARS } from "@/lib/v2/profile";
import { Car } from "../art";
export function OriginalBadge() {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="original-badge-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="original-badge"
        aria-label="Usuario original de Gambling."
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
        onBlur={() => setOpen(false)}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) setOpen(true);
        }}
      >
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path
            d="m16 1 4 3 5-.1 1.8 4.6 4.1 2.8-1 4.7 1 4.7-4.1 2.8-1.8 4.6-5-.1-4 3-4-3-5 .1-1.8-4.6L1.1 20.7l1-4.7-1-4.7 4.1-2.8L7 3.9l5 .1z"
            fill="currentColor"
          />
          <path
            d="m9 16 4.5 4.5L23 11"
            fill="none"
            stroke="#201b10"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <span role="tooltip" className="original-tooltip">
          Usuario original de Gambling.
        </span>
      )}
    </span>
  );
}
export function Avatar({ id, size = 44 }: { id: string; size?: number }) {
  const a = AVATARS.find((a) => a.id === id) ?? AVATARS[0];
  return (
    <span
      className={`player-avatar avatar-${a.id}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 20%,${a.color}66,#161c28 85%)`,
        borderColor: `${a.color}66`,
      }}
      role="img"
      aria-label={`Avatar ${a.name}`}
    >
      {a.id.startsWith("car-") ? (
        <Car color={a.color} />
      ) : a.id.startsWith("roulette-") ? (
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r="34"
            fill={a.color}
            stroke="#e4cc9344"
            strokeWidth="3"
          />
          <circle cx="50" cy="50" r="24" fill="none" stroke="#ffffff22" />
          <circle cx="50" cy="50" r="11" fill="#f5edd9" />
          <circle cx="47" cy="46" r="4" fill="white" opacity=".7" />
        </svg>
      ) : (
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <text
            x="50"
            y="72"
            textAnchor="middle"
            fontSize="72"
            fontFamily="Georgia,serif"
            fill={["heart", "diamond"].includes(a.id) ? "#f07383" : "#e9e8e2"}
          >
            {
              (
                { heart: "♥", club: "♣", diamond: "♦", spade: "♠" } as Record<
                  string,
                  string
                >
              )[a.id]
            }
          </text>
        </svg>
      )}
    </span>
  );
}
export function AvatarPicker({
  value,
  onSave,
  onClose,
}: {
  value: string;
  onSave: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(value),
    [category, setCategory] = useState("Midnight Run"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div
      className="modal-backdrop"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onClose();
      }}
    >
      <div
        className="modal avatar-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-title"
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Cerrar selector"
        >
          <X size={20} />
        </button>
        <div className="avatar-preview">
          <Avatar id={selected} size={86} />
          <div>
            <span className="eyebrow">TU IDENTIDAD EN EL CLUB</span>
            <h2 id="avatar-title">Elige tu avatar.</h2>
            <p>13 diseños. Todos desbloqueados.</p>
          </div>
        </div>
        <div className="v2-tabs">
          {["Midnight Run", "Blackjack", "Ruleta"].map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="avatar-grid">
          {AVATARS.filter((a) => a.category === category).map((a) => (
            <button
              key={a.id}
              className={selected === a.id ? "chosen" : ""}
              onClick={() => setSelected(a.id)}
              aria-label={a.name}
              aria-pressed={selected === a.id}
            >
              <Avatar id={a.id} size={72} />
              <span>{a.name}</span>
              {selected === a.id && <Check size={14} />}
            </button>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        <button
          className="button gold wide"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(selected);
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Guardar avatar
        </button>
      </div>
    </div>
  );
}
