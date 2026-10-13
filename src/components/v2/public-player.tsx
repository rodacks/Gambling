"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "./account";
import { PublicPlayer } from "@/lib/v2/profile";
import { api } from "@/lib/v2/client";
import { demoPlayers } from "@/lib/v2/demo";
import { Avatar, OriginalBadge } from "./identity";
import { fmt, GAME_NAMES, levelFor, Game } from "@/lib/config";
export function PublicProfile({ id }: { id: string }) {
  const { mode, member } = useAccount();
  const [player, setPlayer] = useState<PublicPlayer | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const value =
          mode === "demo"
            ? demoPlayers().find((p) => p.id === id)
            : id.startsWith("demo-")
              ? null
              : await api<PublicPlayer>(
                  `/api/players/${encodeURIComponent(id)}`,
                );
        if (!value)
          throw new Error("Este perfil no está disponible en este modo.");
        if (live) setPlayer(value);
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setLoading(false);
      }
    }
    void load();
    return () => {
      live = false;
    };
  }, [id, mode]);
  return (
    <main className="standalone-page">
      <div className="public-nav">
        <Link href="/" className="brand">
          GAMBLING
        </Link>
        <Link href="/" className="text-link">
          Volver al club
        </Link>
      </div>
      {loading ? (
        <p className="loading-bar">Cargando perfil…</p>
      ) : error ? (
        <div className="panel" role="alert">
          {error}
        </div>
      ) : (
        player && (
          <>
            <div className="profile-hero public-hero">
              <Avatar id={player.avatar} size={96} />
              <div>
                <span className="eyebrow">
                  {mode === "demo"
                    ? "PERFIL FICTICIO · DEMO"
                    : "PERFIL PÚBLICO"}{" "}
                  / NIVEL {levelFor(player.xp)}
                </span>
                <div className="identity-name">
                  <h1>{player.username}</h1>
                  {player.original && <OriginalBadge />}
                </div>
                <p>{player.bio || "Miembro del club."}</p>
                <small>
                  Desde {new Date(player.joinedAt).toLocaleDateString("es-UY")}{" "}
                  · {player.xp} XP
                </small>
              </div>
            </div>
            <div className="public-stats">
              {[
                ["GAMBLINGS", player.balance],
                ["Máximo histórico", player.peak],
                ["Partidas", player.played],
                ["Victorias", player.wins],
                ["Ganado", player.earned],
                ["Perdido", player.lost],
              ].map(([label, value]) => (
                <div className="panel" key={label}>
                  <span>{label}</span>
                  <strong>{fmt(value as number)}</strong>
                </div>
              ))}
            </div>
            <section className="panel">
              <h3>
                Récords personales oficiales{mode === "demo" ? " · DEMO" : ""}
              </h3>
              <div className="records-grid">
                {Object.entries(GAME_NAMES).map(([g, label]) => (
                  <div key={g}>
                    <h4>{label}</h4>
                    <strong>
                      {player.records[g as Game]
                        ? fmt(player.records[g as Game]!)
                        : "—"}{" "}
                      <small>
                        {g === "reaction"
                          ? "ms"
                          : g === "jitter"
                            ? "clics"
                            : g === "precision"
                              ? "pts"
                              : "G netos"}
                      </small>
                    </strong>
                  </div>
                ))}
              </div>
            </section>
            {member?.id === player.id && (
              <p className="fine-print">
                Es tu perfil. Puedes editarlo desde «Mi perfil» en el club.
              </p>
            )}
          </>
        )
      )}
    </main>
  );
}
