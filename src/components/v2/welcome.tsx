"use client";
import { useState } from "react";
import { Coins, Sparkles } from "lucide-react";
import { useAccount } from "./account";
export function WelcomeReward() {
  const { member, mode, acknowledge } = useAccount();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!member?.welcomePending) return null;
  return (
    <div className="modal-backdrop">
      <div
        className="modal welcome-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
      >
        <span className="eyebrow">
          {mode === "demo" ? "RECOMPENSA FICTICIA · DEMO" : "CUENTA ORIGINAL"}
        </span>
        <div className="welcome-coin">
          <Coins size={52} />
          <Sparkles size={23} />
        </div>
        <h2 id="welcome-title">¡BIENVENIDO A GAMBLING!</h2>
        <p>
          Por crear una cuenta original de GAMBLING, recibiste una recompensa
          exclusiva.
        </p>
        <strong>
          +5.000 <small>GAMBLINGS</small>
        </strong>
        <p className="fine-print">
          Ya está registrada en tu saldo. Este botón confirma la bienvenida.
        </p>
        {error && <p role="alert">{error}</p>}
        <button
          autoFocus
          className="button gold wide"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await acknowledge();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          RECLAMAR RECOMPENSA
        </button>
      </div>
    </div>
  );
}
