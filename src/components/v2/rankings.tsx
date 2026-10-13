"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Crown,
  Trophy,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useAccount } from "./account";
import { RANKINGS, Ranking } from "@/lib/v2/config";
import { RankingRow } from "@/lib/v2/profile";
import { demoPlayers, rankPlayers } from "@/lib/v2/demo";
import { api } from "@/lib/v2/client";
import { Avatar, OriginalBadge } from "./identity";
import { fmt, Game } from "@/lib/config";
type Rows = { rows: RankingRow[]; me: RankingRow | null; hasMore: boolean };
function valueLabel(value: number, kind: Ranking) {
  return `${fmt(value)} ${kind === "reaction" ? "ms" : kind === "jitter" ? "clics" : kind === "precision" ? "pts" : "G"}`;
}
export function Rankings({
  game,
  compact = false,
}: {
  game?: Game;
  compact?: boolean;
}) {
  const { mode, member } = useAccount();
  const [kind, setKind] = useState<Ranking>(game ?? "balance"),
    [page, setPage] = useState(0),
    [data, setData] = useState<Rows>({ rows: [], me: null, hasMore: false }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, reload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const load = async () => {
      try {
        let next: Rows;
        if (mode === "demo") {
          const ranked = rankPlayers(demoPlayers(), kind);
          next = {
            rows: ranked.slice(page * 20, page * 20 + 20),
            me: ranked.find((r) => r.id === member?.id) ?? null,
            hasMore: ranked.length > (page + 1) * 20 && page < 4,
          };
        } else if (mode === "online")
          next = await api<Rows>(`/api/rankings?kind=${kind}&page=${page}`);
        else next = { rows: [], me: null, hasMore: false };
        if (!cancelled) setData(next);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [mode, kind, page, member?.id, revision]);
  const rows = compact ? data.rows.slice(0, 5) : data.rows;
  const contents = (
    <>
      <div className="ranking-heading">
        <div>
          <span className="eyebrow">
            {mode === "demo"
              ? "DATOS FICTICIOS · DEMO"
              : "CLASIFICACIONES OFICIALES"}
          </span>
          <h2>{compact ? "Top 5 global" : "El club de los mejores."}</h2>
          <p>
            {["blackjack", "racing", "roulette"].includes(kind)
              ? "Mayor ganancia neta en una sola partida."
              : kind === "reaction"
                ? "Menor reacción válida. Un solo modo."
                : kind === "jitter"
                  ? "Mayor número de clics válidos en 10 segundos."
                  : kind === "precision"
                    ? "Mayor puntuación válida en 20 segundos."
                    : kind === "peak"
                      ? "El mayor saldo alcanzado."
                      : "Saldo actual de GAMBLINGS."}
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="Actualizar rankings"
          onClick={() => reload((r) => r + 1)}
          disabled={loading}
        >
          <RefreshCw size={17} />
        </button>
      </div>
      {!compact && (
        <div className="v2-tabs ranking-tabs">
          {Object.entries(RANKINGS).map(([k, label]) => (
            <button
              key={k}
              className={kind === k ? "active" : ""}
              onClick={() => {
                setKind(k as Ranking);
                setPage(0);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {mode === "local" ? (
        <div className="online-empty">
          <Trophy size={32} />
          <h3>El ranking espera a su primer jugador.</h3>
          <p>
            Configura Supabase para consultar resultados reales. Tu partida
            local no se importa a clasificaciones oficiales. Los datos ficticios
            solo aparecen con <code>npm run dev:demo</code>.
          </p>
        </div>
      ) : loading ? (
        <p className="loading-bar">Buscando las mejores jugadas…</p>
      ) : error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : !rows.length ? (
        <div className="online-empty">
          <Trophy size={30} />
          <h3>Todavía no hay récords.</h3>
          <p>Completa una partida válida para entrar en esta clasificación.</p>
        </div>
      ) : (
        <>
          {!compact && page === 0 && (
            <div className="podium">
              {rows.slice(0, 3).map((r, i) => (
                <div key={r.id} className={`podium-card podium-${i}`}>
                  <span>
                    <Crown size={16} /> #{r.position}
                  </span>
                  <Link
                    href={`/players/${r.id}`}
                    aria-label={`Perfil de ${r.username}`}
                  >
                    <Avatar id={r.avatar} size={64} />
                  </Link>
                  <div className="identity-name">
                    <Link href={`/players/${r.id}`}>{r.username}</Link>
                    {r.original && <OriginalBadge />}
                  </div>
                  <strong>{valueLabel(r.value, kind)}</strong>
                </div>
              ))}
            </div>
          )}
          <div className="ranking-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>JUGADOR</th>
                  <th>{kind === "reaction" ? "TIEMPO" : "RÉCORD"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={r.id === member?.id ? "my-ranking" : ""}
                  >
                    <td>{r.position}</td>
                    <td>
                      <div className="rank-identity">
                        <Link href={`/players/${r.id}`}>
                          <Avatar id={r.avatar} size={35} />
                        </Link>
                        <Link href={`/players/${r.id}`}>{r.username}</Link>
                        {r.original && <OriginalBadge />}
                        {r.id === member?.id && <small>TÚ</small>}
                      </div>
                    </td>
                    <td>{valueLabel(r.value, kind)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {member && mode !== "local" && (
        <div className="my-position">
          <Trophy size={15} />
          {data.me
            ? `Tu posición: #${data.me.position} · Tu récord: ${valueLabel(data.me.value, kind)}`
            : "Tu posición: sin resultado oficial en esta categoría."}
        </div>
      )}
      {!compact && mode !== "local" && (
        <div className="pagination">
          <button
            className="button secondary"
            disabled={!page || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={15} /> Anterior
          </button>
          <span>Página {page + 1} · Top 100</span>
          <button
            className="button secondary"
            disabled={!data.hasMore || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente <ChevronRight size={15} />
          </button>
        </div>
      )}
    </>
  );
  return compact ? (
    <details className="panel mini-rankings">
      <summary>
        <Trophy size={16} /> Récords globales · {RANKINGS[kind]}
        <ChevronRight size={15} />
      </summary>
      <div>{contents}</div>
    </details>
  ) : (
    <section className="panel rankings-page">{contents}</section>
  );
}
