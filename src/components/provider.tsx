"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { Action, freshSave, parseSave, Save, transition } from "@/lib/engine";
import { STORAGE_KEY } from "@/lib/storage";
import { useAccount } from "./v2/account";
import { api } from "@/lib/v2/client";
import { demoSaveKey } from "@/lib/v2/demo";
type Context = {
  state: Save;
  ready: boolean;
  error: string;
  clearError: () => void;
  act: (a: Action) => Promise<Save | null>;
  reset: () => Promise<void>;
  online: boolean;
};
const GameContext = createContext<Context | null>(null);
export function Provider({ children }: { children: ReactNode }) {
  const { mode, member, loading } = useAccount();
  const online = mode === "online" && !!member;
  const key =
    mode === "demo" ? demoSaveKey(member?.id ?? "guest") : STORAGE_KEY;
  const [state, setState] = useState<Save>(freshSave),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const queue = useRef<Promise<unknown>>(Promise.resolve()),
    epoch = useRef(0),
    mutations = useRef(0),
    pending = useRef(0);
  const exclusive = useCallback(
    <T,>(fn: () => T): Promise<T> =>
      navigator.locks
        ? navigator.locks.request(key, fn)
        : Promise.reject(new Error("Abre el juego en localhost o HTTPS.")),
    [key],
  );
  const load = useCallback(() => {
    const raw = localStorage.getItem(key);
    return raw ? parseSave(raw) : freshSave();
  }, [key]);
  useEffect(() => {
    if (loading) return;
    const current = ++epoch.current;
    setReady(false);
    setError("");
    const refresh = async () => {
      if (pending.current) return;
      const revision = mutations.current;
      try {
        const saved = online
          ? await api<{ state: Save }>("/api/game").then((r) => r.state)
          : await exclusive(() => {
              const s = load();
              localStorage.setItem(key, JSON.stringify(s));
              return s;
            });
        if (
          epoch.current === current &&
          mutations.current === revision &&
          !pending.current
        ) {
          setState(saved);
          setReady(true);
        }
      } catch (e) {
        if (epoch.current === current)
          setError(`No se pudo cargar el progreso: ${(e as Error).message}`);
      }
    };
    void queue.current.then(refresh);
    const sync = (e: StorageEvent) => {
      if (e.key === key && !online) void refresh();
    };
    const visible = () => {
      if (!document.hidden && online) void refresh();
    };
    window.addEventListener("storage", sync);
    document.addEventListener("visibilitychange", visible);
    const timer = online ? setInterval(visible, 15000) : undefined;
    return () => {
      epoch.current++;
      window.removeEventListener("storage", sync);
      document.removeEventListener("visibilitychange", visible);
      clearInterval(timer);
    };
  }, [loading, online, member?.id, key, load, exclusive]);
  const act = useCallback(
    (action: Action): Promise<Save | null> => {
      mutations.current++;
      pending.current++;
      const current = epoch.current,
        operationId = crypto.randomUUID();
      const job = queue.current
        .then(async () => {
          if (current !== epoch.current)
            throw new Error("La sesión cambió. Vuelve a intentarlo.");
          let next: Save;
          if (online) {
            const request = { operationId, action };
            let reply: { state: Save };
            try {
              reply = await api("/api/game", request);
            } catch (e) {
              if (e instanceof TypeError)
                reply = await api("/api/game", request);
              else throw e;
            }
            next = reply.state;
          } else
            next = await exclusive(() => {
              const previous = load();
              const next = transition(previous, action);
              localStorage.setItem(key, JSON.stringify(next));
              return next;
            });
          if (current === epoch.current) setState(next);
          return next;
        })
        .catch((e) => {
          if (current === epoch.current)
            setError((e as Error).message ?? "No se pudo guardar.");
          return null;
        })
        .finally(() => {
          pending.current--;
        });
      queue.current = job;
      return job;
    },
    [online, key, exclusive, load],
  );
  const reset = useCallback(async () => {
    if (online) {
      setError("El progreso oficial no se reinicia desde el navegador.");
      return;
    }
    try {
      await exclusive(() => {
        const next = freshSave();
        if (member) next.name = member.username;
        localStorage.setItem(key, JSON.stringify(next));
        setState(next);
        setReady(true);
        setError("");
      });
    } catch {
      setError("El navegador no permite guardar.");
    }
  }, [online, exclusive, key, member]);
  useEffect(() => {
    // Profile changes already persist in their own repository. Do not enqueue a
    // gameplay write while switching accounts: it can race the initial load.
    if (member && ready)
      setState((s) =>
        s.name === member.username ? s : { ...s, name: member.username },
      );
  }, [member?.username, ready]);
  return (
    <GameContext.Provider
      value={{
        state,
        ready,
        error,
        clearError: () => setError(""),
        act,
        reset,
        online,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
export function useGame() {
  const c = useContext(GameContext);
  if (!c) throw new Error("Provider ausente");
  return c;
}
