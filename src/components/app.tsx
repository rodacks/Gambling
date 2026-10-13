"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Coins,
  Crown,
  Flag,
  Gamepad2,
  Gift,
  LayoutGrid,
  Settings,
  ShieldCheck,
  Sparkles,
  Spade,
  Trophy,
  UserRound,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { useGame } from "./provider";
import { bonusRemaining } from "@/lib/engine";
import { fmt, Game, GAME_NAMES, levelFor, MEDALS, Skill } from "@/lib/config";
import { CardsArt, Car, SkillArt, WheelArt } from "./art";
import { Coin, History, SoundPreview, useGate } from "./shared";
import { Blackjack } from "./games/blackjack";
import { Racing } from "./games/racing";
import { Roulette } from "./games/roulette";
import { SkillGame } from "./games/skills";
import { useAccount } from "./v2/account";
import { Avatar, OriginalBadge } from "./v2/identity";
import { ProfileEditor } from "./v2/profile-editor";
import { AuthScreen } from "./v2/auth-screen";
import { WelcomeReward } from "./v2/welcome";
import { Rankings } from "./v2/rankings";
type View =
  | "rankings"
  | "auth"
  | "home"
  | "casino"
  | "skills"
  | "profile"
  | "settings"
  | Game;
const games: Game[] = [
  "blackjack",
  "racing",
  "roulette",
  "jitter",
  "reaction",
  "precision",
];
const subtitles: Record<Game, string> = {
  blackjack: "Una buena mano lo cambia todo.",
  racing: "Seis pilotos. Una noche sin límites.",
  roulette: "Dale una vuelta a tu suerte.",
  jitter: "Diez segundos. Tu mejor ritmo.",
  reaction: "La diferencia es un instante.",
  precision: "Concentración. Pulso. Precisión.",
};
function DailyBonus() {
  const { state, act, ready } = useGame();
  const [now, setNow] = useState(0);
  const { busy, run } = useGate();
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = bonusRemaining(state, now);
  const time = [
    Math.floor(left / 3600000),
    Math.floor(left / 60000) % 60,
    Math.floor(left / 1000) % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  return (
    <div className="daily-card">
      <div className="daily-top">
        <span className="eyebrow">TU INVITACIÓN DIARIA</span>
        <Gift size={20} />
      </div>
      <div className="gift-art">
        <Gift size={58} strokeWidth={1.1} />
        <i>+</i>
        <b>✦</b>
      </div>
      <h3>La casa invita.</h3>
      <p>Vuelve cada 24 horas por tu bonus.</p>
      <div className="daily-amount">
        <Coin value={5000} />
        <span>MONEDAS GRATIS</span>
      </div>
      <button
        className="button gold wide"
        disabled={!ready || busy || left > 0}
        onClick={() => void run(() => act({ type: "daily" }))}
      >
        {left > 0 ? (
          `Próximo bonus · ${time}`
        ) : (
          <>
            Reclamar bonus <ArrowRight size={16} />
          </>
        )}
      </button>
    </div>
  );
}
function StatsStrip() {
  const { state } = useGame();
  const values = [
    {
      label: "GANADO EN JUEGOS",
      value: state.earned,
      icon: ArrowUpRight,
      cls: "positive",
    },
    {
      label: "PERDIDO EN JUEGOS",
      value: state.lost,
      icon: ArrowDownLeft,
      cls: "negative",
    },
    {
      label: "BENEFICIO NETO",
      value: state.earned - state.lost,
      icon: Coins,
      cls: state.earned >= state.lost ? "positive" : "negative",
    },
    {
      label: "RÉCORD DE SALDO",
      value: state.peak,
      icon: Trophy,
      cls: "gold-text",
    },
  ];
  return (
    <div className="stats-strip">
      {values.map((v) => (
        <div key={v.label}>
          <span className={`stat-icon ${v.cls}`}>
            <v.icon size={18} />
          </span>
          <div>
            <small>{v.label}</small>
            <strong className={v.cls}>{fmt(v.value)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}
function GameCard({ game, go }: { game: Game; go: (v: View) => void }) {
  const casino = games.indexOf(game) < 3;
  return (
    <button className={`game-card game-card-${game}`} onClick={() => go(game)}>
      <div className="game-card-art">
        <span className="game-tag">
          {game === "blackjack"
            ? "EL CLÁSICO"
            : game === "racing"
              ? "FAVORITO DEL CLUB"
              : game === "roulette"
                ? "EUROPEAN EDITION"
                : "SIN APUESTA"}
        </span>
        {game === "blackjack" ? (
          <CardsArt />
        ) : game === "racing" ? (
          <div className="car-art">
            <div className="speed-lines" />
            <Car />
            <Car color="#897af1" />
          </div>
        ) : game === "roulette" ? (
          <WheelArt />
        ) : (
          <SkillArt kind={game} />
        )}
      </div>
      <div className="game-card-info">
        <div>
          <h3>{GAME_NAMES[game]}</h3>
          <p>{subtitles[game]}</p>
        </div>
        <span className="card-arrow">
          <ArrowUpRight size={20} />
        </span>
      </div>
      <div className="game-card-meta">
        <span>
          {casino
            ? game === "blackjack"
              ? "♠  Hasta 3:2"
              : game === "racing"
                ? "⚑  Cuotas hasta 15×"
                : "◉  Hasta 35:1"
            : "✦  Gana hasta 490 monedas"}
        </span>
        <span>
          {casino ? "JUGAR AHORA" : "ACEPTAR RETO"} <ChevronRight size={12} />
        </span>
      </div>
    </button>
  );
}
function Lobby({ view, go }: { view: View; go: (v: View) => void }) {
  const { state } = useGame();
  return (
    <>
      {view === "home" && (
        <>
          <div className="lobby-intro">
            <div>
              <span className="eyebrow">TU CLUB. TUS REGLAS. TU NOCHE.</span>
              <h1>
                Bienvenido al club<span>.</span>
              </h1>
              <p>Un poco de suerte. Mucha actitud. Todo por jugar.</p>
            </div>
            <div className="club-open">
              <i className="live-dot" /> EL CLUB ESTÁ ABIERTO
            </div>
          </div>
          <div className="hero-grid">
            <div className="hero">
              <div className="hero-copy">
                <span className="hero-pill">
                  <Sparkles size={13} /> THE NIGHT IS YOURS
                </span>
                <h2>
                  Juega tus cartas.
                  <br />
                  Crea tu fortuna.
                </h2>
                <p>
                  La emoción del casino.
                  <br />
                  El poder de tu habilidad.
                </p>
                <button className="button gold" onClick={() => go("blackjack")}>
                  Entrar a la mesa <ArrowUpRight size={17} />
                </button>
                <small>
                  <ShieldCheck size={13} /> 100% virtual. 100% tuyo.
                </small>
              </div>
              <div className="hero-art">
                <div className="hero-orbit" />
                <CardsArt />
                <span className="hero-star">✦</span>
                <span className="hero-caption">EST. 2026 / MEMBERS CLUB</span>
              </div>
            </div>
            <DailyBonus />
          </div>
          <StatsStrip />
        </>
      )}
      {view !== "home" && (
        <div className="lobby-intro">
          <div>
            <span className="eyebrow">
              {view === "casino"
                ? "EL AZAR TIENE SU ENCANTO"
                : "EL TALENTO TIENE RECOMPENSA"}
            </span>
            <h1>
              {view === "casino" ? "Casino" : "Skill Games"}
              <span>.</span>
            </h1>
            <p>
              {view === "casino"
                ? "Elige una mesa. Haz tu jugada."
                : "Juega gratis y convierte tu habilidad en monedas."}
            </p>
          </div>
        </div>
      )}
      {view !== "skills" && (
        <section className="game-section">
          <div className="section-title">
            <h2>
              <Spade size={22} /> Casino <span>03 JUEGOS</span>
            </h2>
            <span className="section-caption">LA SUERTE TAMBIÉN SE JUEGA</span>
          </div>
          <div className="game-grid">
            {games.slice(0, 3).map((g) => (
              <GameCard key={g} game={g} go={go} />
            ))}
          </div>
        </section>
      )}
      {view !== "casino" && (
        <section className="game-section">
          <div className="section-title">
            <h2>
              <Zap size={22} /> Skill Games <span>ENTRADA GRATIS</span>
            </h2>
            <span className="section-caption">TU HABILIDAD PAGA</span>
          </div>
          <div className="game-grid skill-grid">
            {games.slice(3).map((g) => (
              <GameCard key={g} game={g} go={go} />
            ))}
          </div>
        </section>
      )}
      {state.balance < 100 && (
        <div className="recovery-note">
          <Gift size={20} />
          <p>
            La próxima jugada puede ser gratis. Los Skill Games siempre están
            abiertos para recuperar monedas.
          </p>
          <button onClick={() => go("skills")}>
            Ver desafíos <ArrowRight size={16} />
          </button>
        </div>
      )}
      <History />
    </>
  );
}
function Profile() {
  const { member } = useAccount();
  const { state, act } = useGame();
  const [name, setName] = useState(state.name),
    [saved, setSaved] = useState(false);
  const entries = Object.entries(state.stats) as [
    Game,
    typeof state.stats.blackjack,
  ][];
  const played = entries.reduce((a, [, s]) => a + s.played, 0),
    wins = entries.reduce((a, [, s]) => a + s.wins, 0),
    losses = entries.reduce((a, [, s]) => a + s.losses, 0);
  const favorite = [...entries].sort((a, b) => b[1].played - a[1].played)[0];
  const level = levelFor(state.xp);
  return (
    <>
      <div className="profile-hero">
        <div className="profile-avatar">
          {member ? (
            <Avatar id={member.avatar} size={86} />
          ) : (
            <Crown size={42} />
          )}
        </div>
        <div>
          <span className="eyebrow">MIEMBRO DEL CLUB / NIVEL {level}</span>
          <div className="identity-name">
            <h1>{state.name}</h1>
            {member?.original && <OriginalBadge />}
          </div>
          <p>
            {level < 5
              ? "Rookie del club"
              : level < 10
                ? "Habitual de la noche"
                : "Leyenda del club"}{" "}
            · {state.xp} XP
          </p>
          <div className="xp-track">
            <i style={{ width: `${((state.xp % 250) / 250) * 100}%` }} />
          </div>
          <small>{250 - (state.xp % 250)} XP para el siguiente nivel</small>
        </div>
        <div className="profile-balance">
          <span>TU FORTUNA</span>
          <Coin value={state.balance} />
        </div>
      </div>
      <StatsStrip />
      <ProfileEditor key={member?.id ?? "guest"} />
      <div className="profile-grid">
        <section className="panel">
          <h3>{member ? "Tus estadísticas" : "Tu identidad local"}</h3>
          {!member && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const result = await act({ type: "profile", name });
                if (result) setSaved(true);
              }}
            >
              <label htmlFor="player-name">Nombre del jugador</label>
              <div className="name-input">
                <input
                  id="player-name"
                  value={name}
                  maxLength={24}
                  required
                  onChange={(e) => {
                    setName(e.target.value);
                    setSaved(false);
                  }}
                />
                <button className="button gold" type="submit">
                  {saved ? <Check size={17} /> : "Guardar"}
                </button>
              </div>
            </form>
          )}
          <div className="profile-numbers">
            <div>
              <b>{played}</b>
              <span>Partidas</span>
            </div>
            <div>
              <b>{wins}</b>
              <span>Victorias</span>
            </div>
            <div>
              <b>{losses}</b>
              <span>Derrotas</span>
            </div>
          </div>
          <p className="fine-print">
            Favorito: {played ? GAME_NAMES[favorite[0]] : "Aún por descubrir"} ·
            Monedas recibidas de bienvenida y bonus: {fmt(state.granted)}. El
            neto de juegos excluye esos regalos.
          </p>
        </section>
        <section className="panel">
          <h3>Vitrina de logros</h3>
          <div className="achievement-grid">
            {[
              { title: "Primera noche", done: played > 0, icon: Spade },
              { title: "Diez partidas", done: played >= 10, icon: Gamepad2 },
              {
                title: "Club de los 10K",
                done: state.peak >= 10000,
                icon: Coins,
              },
              { title: "Nivel cinco", done: level >= 5, icon: Crown },
            ].map((a) => (
              <div
                className={`achievement ${a.done ? "unlocked" : ""}`}
                key={a.title}
              >
                <a.icon size={28} />
                <b>{a.title}</b>
                <small>{a.done ? "DESBLOQUEADO" : "POR DESCUBRIR"}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="section-title">
          <h3>Tu récord, tu próxima meta</h3>
          <span>SKILL GAMES</span>
        </div>
        <div className="records-grid">
          {(["jitter", "reaction", "precision"] as Skill[]).map((g) => (
            <div key={g}>
              <h4>{GAME_NAMES[g]}</h4>
              <strong>
                {state.stats[g].best || "—"}{" "}
                <small>
                  {g === "reaction"
                    ? "ms"
                    : g === "jitter"
                      ? "clics"
                      : "puntos"}
                </small>
              </strong>
              <p>
                {state.stats[g].played} partidas · {fmt(state.stats[g].earned)}{" "}
                monedas ganadas
              </p>
              <div className="record-medals">
                {MEDALS.map((m, i) => (
                  <span
                    className={
                      state.stats[g].medals.includes(i) ? "earned" : ""
                    }
                    key={m}
                    title={m}
                  >
                    <Trophy size={16} />
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <History limit={15} />
      <section className="panel ledger-panel">
        <h3>Movimientos de monedas</h3>
        <div className="ledger">
          {state.ledger.length ? (
            state.ledger.slice(0, 20).map((m) => (
              <div key={m.id}>
                <span>
                  {m.label}
                  <small>{new Date(m.at).toLocaleString("es-UY")}</small>
                </span>
                <span className={m.amount >= 0 ? "positive" : "negative"}>
                  <Coin value={m.amount} sign />
                </span>
              </div>
            ))
          ) : (
            <p>Tu saldo inicial de 5.000 monedas ya está disponible.</p>
          )}
        </div>
      </section>
    </>
  );
}
function SettingsPage({ onReset }: { onReset: () => void }) {
  const { state, act, reset, online } = useGame();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <div className="lobby-intro">
        <div>
          <span className="eyebrow">A TU MANERA</span>
          <h1>
            Ajustes<span>.</span>
          </h1>
          <p>Haz del club tu lugar.</p>
        </div>
      </div>
      <div className="settings-panels">
        <section className="panel">
          <h3>Experiencia</h3>
          <div className="setting-row">
            <div>
              <b>
                <Volume2 size={18} /> Sonido
              </b>
              <p>Efectos suaves al acertar y al terminar una partida.</p>
            </div>
            <button
              role="switch"
              aria-checked={state.settings.sound}
              aria-label="Activar sonido"
              className={`toggle ${state.settings.sound ? "on" : ""}`}
              onClick={() =>
                void act({
                  type: "settings",
                  settings: { sound: !state.settings.sound },
                })
              }
            >
              <i />
            </button>
          </div>
          {state.settings.sound && <SoundPreview />}
          <div className="setting-row">
            <div>
              <b>
                <Sparkles size={18} /> Reducir animaciones
              </b>
              <p>Acorta los giros y carreras, y elimina efectos decorativos.</p>
            </div>
            <button
              role="switch"
              aria-checked={state.settings.reducedMotion}
              aria-label="Reducir animaciones"
              className={`toggle ${state.settings.reducedMotion ? "on" : ""}`}
              onClick={() =>
                void act({
                  type: "settings",
                  settings: { reducedMotion: !state.settings.reducedMotion },
                })
              }
            >
              <i />
            </button>
          </div>
        </section>
        <section className="panel">
          <h3>
            <ShieldCheck size={19} /> Tu progreso
          </h3>
          {online && (
            <p>
              Cuenta online: economía y récords administrados por el servidor.
              El progreso oficial no se puede reiniciar aquí.
            </p>
          )}
          <p>
            {online
              ? "Tu cuenta se guarda en el servidor. Los resultados oficiales se validan antes de incorporarse al ranking."
              : "El guardado local vive en este navegador. Saldo y récords locales pueden modificarse desde las herramientas del navegador y no se importan al ranking oficial."}
          </p>
          <p>
            Todas las monedas son ficticias. No hay depósitos, retiros, compras
            ni premios con valor económico.
          </p>
          <button
            className="button danger"
            disabled={online}
            onClick={() => setConfirm(true)}
          >
            Reiniciar progreso
          </button>
        </section>
        <section className="panel">
          <h3>
            <CircleHelp size={19} /> Cómo funciona el club
          </h3>
          <p>
            Comienzas con 5.000 monedas y puedes reclamar otras 5.000 cada 24
            horas desde la última reclamación. Puedes apostar hasta tu saldo
            completo.
          </p>
          <p>
            Obtienes 35 XP por una partida con ganancia y 15 XP por los demás
            resultados. Cada 250 XP subes de nivel. El nivel desbloquea
            distintivos y nunca altera las probabilidades del casino.
          </p>
          <p>
            Ganado y perdido reflejan resultados netos de partidas. Los bonos se
            registran aparte. Un empate devuelve la apuesta y las cuotas de
            carreras incluyen la devolución de la apuesta.
          </p>
        </section>
      </div>
      {confirm && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <button
              className="modal-close"
              aria-label="Cancelar"
              onClick={() => setConfirm(false)}
            >
              <X size={20} />
            </button>
            <h2 id="reset-title">¿Empezar una nueva noche?</h2>
            <p>
              Se borrarán el saldo, las estadísticas, los récords y el historial
              de este navegador. Volverás a tener 5.000 monedas.
            </p>
            <div className="action-pair">
              <button
                autoFocus
                className="button secondary"
                onClick={() => setConfirm(false)}
              >
                Cancelar
              </button>
              <button
                className="button danger"
                onClick={async () => {
                  await reset();
                  setConfirm(false);
                  onReset();
                }}
              >
                Sí, reiniciar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export function App() {
  const { mode, member, error: accountError } = useAccount();
  const { state, ready, error, clearError } = useGame();
  const [view, setView] = useState<View>("home");
  const level = levelFor(state.xp);
  useEffect(() => {
    if (state.active) setView(state.active.game);
  }, [state.active?.id]);
  const go = (v: View) => {
    if (state.active && v !== state.active.game) return;
    setView(v);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const nav = [
    { view: "home" as View, label: "El club", icon: LayoutGrid },
    { view: "casino" as View, label: "Casino", icon: Spade },
    { view: "skills" as View, label: "Skill Games", icon: Zap },
    { view: "profile" as View, label: "Mi perfil", icon: UserRound },
    { view: "rankings" as View, label: "Rankings", icon: Trophy },
  ];
  const inGame = games.includes(view as Game);
  return (
    <MotionConfig
      reducedMotion={state.settings.reducedMotion ? "always" : "user"}
    >
      <div
        className={`app-shell ${state.settings.reducedMotion ? "reduce-motion" : ""}`}
      >
        <aside className="sidebar">
          <button
            className="brand"
            onClick={() => go("home")}
            aria-label="GAMBLING inicio"
          >
            <span className="brand-mark">
              G<span>♦</span>
            </span>
            <strong>
              GAMBLING<small>THE VIRTUAL CLUB</small>
            </strong>
          </button>
          <span className="nav-caption">DESCUBRE EL CLUB</span>
          <nav>
            {nav.map((n) => (
              <button
                key={n.view}
                disabled={!!state.active}
                className={
                  view === n.view ||
                  (n.view === "casino" &&
                    ["blackjack", "racing", "roulette"].includes(view)) ||
                  (n.view === "skills" &&
                    ["jitter", "reaction", "precision"].includes(view))
                    ? "active"
                    : ""
                }
                onClick={() => go(n.view)}
              >
                <n.icon size={19} />
                {n.label}
                {n.view === "skills" && (
                  <span className="free-badge">FREE</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-note">
            <div className="small-spark">✦</div>
            <h4>
              La habilidad
              <br />
              también tiene premio.
            </h4>
            <p>
              Desafíos gratis.
              <br />
              Recompensas reales en el juego.
            </p>
            <button disabled={!!state.active} onClick={() => go("skills")}>
              Descubrir retos <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="sidebar-bottom">
            <button
              disabled={!!state.active}
              onClick={() => go("settings")}
              className={view === "settings" ? "active" : ""}
            >
              <Settings size={18} /> Ajustes
            </button>
            <span>
              <ShieldCheck size={13} /> SOLO MONEDAS VIRTUALES
            </span>
            <small>GAMBLING © 2026 · V2.0</small>
          </div>
        </aside>
        <div className="app-main">
          <header className="topbar">
            <div className="breadcrumb">
              <span>GAMBLING</span>
              <ChevronRight size={13} />
              <b>
                {inGame
                  ? GAME_NAMES[view as Game]
                  : view === "home"
                    ? "El club"
                    : view === "skills"
                      ? "Skill Games"
                      : view === "casino"
                        ? "Casino"
                        : view === "profile"
                          ? "Mi perfil"
                          : view === "rankings"
                            ? "Rankings"
                            : view === "auth"
                              ? "Cuenta"
                              : "Ajustes"}
              </b>
            </div>
            <div className="header-actions">
              <button
                className="account-entry"
                aria-label={member ? member.username : "Cuenta"}
                disabled={!!state.active}
                onClick={() => go(member ? "profile" : "auth")}
              >
                <UserRound size={16} />
                <span>{member ? member.username : "Cuenta"}</span>
              </button>
              {member?.original && <OriginalBadge />}
              <div className="wallet">
                <span>SALDO DISPONIBLE</span>
                <motion.strong
                  key={state.balance}
                  initial={{ opacity: 0.4, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Coin value={state.balance} />
                </motion.strong>
              </div>
              <button
                className="header-avatar"
                disabled={!!state.active}
                onClick={() => go("profile")}
                aria-label="Abrir perfil"
              >
                {member ? (
                  <Avatar id={member.avatar} size={36} />
                ) : (
                  <span>{state.name.slice(0, 1).toUpperCase()}</span>
                )}
                <b>{level}</b>
              </button>
            </div>
          </header>
          <main>
            <div className={`mode-banner mode-${mode}`}>
              <span>
                {mode === "demo"
                  ? "DEMO · DESARROLLO · DATOS FICTICIOS"
                  : mode === "online" && member
                    ? "CUENTA ONLINE · PROGRESO EN EL SERVIDOR"
                    : "MODO LOCAL · SIN RANKINGS OFICIALES"}
              </span>
              {!member && (
                <button disabled={!!state.active} onClick={() => go("auth")}>
                  Entrar al club <ArrowRight size={13} />
                </button>
              )}
            </div>
            {accountError && (
              <p className="form-error" role="alert">
                {accountError}
              </p>
            )}
            {error && (
              <div className="error-banner" role="alert">
                <span>{error}</span>
                <button onClick={clearError} aria-label="Cerrar error">
                  <X size={18} />
                </button>
              </div>
            )}
            {!ready && !error && (
              <div className="loading-bar">Preparando tu club…</div>
            )}
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                {inGame && (
                  <div className="game-page-header">
                    <button
                      disabled={!!state.active}
                      onClick={() =>
                        go(
                          games.indexOf(view as Game) < 3 ? "casino" : "skills",
                        )
                      }
                    >
                      <ChevronLeft size={17} /> Volver al club
                    </button>
                    <div>
                      <h1>
                        {GAME_NAMES[view as Game]}
                        <span>.</span>
                      </h1>
                      <p>{subtitles[view as Game]}</p>
                    </div>
                    {state.active && (
                      <span className="in-progress">
                        <i className="live-dot" /> PARTIDA EN CURSO
                      </span>
                    )}
                  </div>
                )}
                {["home", "casino", "skills"].includes(view) ? (
                  <Lobby view={view} go={go} />
                ) : view === "blackjack" ? (
                  <Blackjack />
                ) : view === "racing" ? (
                  <Racing />
                ) : view === "roulette" ? (
                  <Roulette />
                ) : ["jitter", "reaction", "precision"].includes(view) ? (
                  <SkillGame key={view} game={view as Skill} />
                ) : view === "rankings" ? (
                  <Rankings />
                ) : view === "auth" ? (
                  <AuthScreen onDone={() => go("home")} />
                ) : view === "profile" ? (
                  <Profile key={member?.id ?? "local"} />
                ) : (
                  <SettingsPage onReset={() => go("home")} />
                )}
                {inGame && !state.active && (
                  <Rankings
                    key={view + state.history[0]?.id}
                    game={view as Game}
                    compact
                  />
                )}
              </motion.div>
            </AnimatePresence>
            <footer>
              <span>
                <ShieldCheck size={14} /> Gratis. Ficticio. Solo diversión.
              </span>
              <span>
                Sin dinero real ·{" "}
                {mode === "online" && member
                  ? "Progreso sincronizado"
                  : "Progreso en este navegador"}
              </span>
              <b>
                PLAY YOUR WAY. <span>G.</span>
              </b>
            </footer>
          </main>
          <nav className="mobile-nav">
            {nav.map((n) => (
              <button
                key={n.view}
                disabled={!!state.active}
                className={view === n.view ? "active" : ""}
                onClick={() => go(n.view)}
              >
                <n.icon size={19} />
                <span>{n.label}</span>
              </button>
            ))}
            <button
              disabled={!!state.active}
              onClick={() => go("settings")}
              aria-label="Ajustes"
            >
              <Settings size={19} />
              <span>Ajustes</span>
            </button>
          </nav>
        </div>
      </div>
      <WelcomeReward />
    </MotionConfig>
  );
}
