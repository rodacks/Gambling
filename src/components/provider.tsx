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
import { Action, freshSave, Save, transition } from "@/lib/engine";
import { localRepository, STORAGE_KEY } from "@/lib/storage";
type Context = {
  state: Save;
  ready: boolean;
  error: string;
  clearError: () => void;
  act: (a: Action) => Promise<Save | null>;
  reset: () => Promise<void>;
};
const GameContext = createContext<Context | null>(null);
export function Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Save>(freshSave),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const exclusive = useCallback(<T,>(fn: () => T): Promise<T> => {
    // Web Locks serializes writes across tabs, including the first save and reset.
    if (navigator.locks) return navigator.locks.request(STORAGE_KEY, fn);
    return Promise.reject(
      new Error(
        "Abre el juego en localhost o HTTPS para habilitar el guardado seguro entre pestañas.",
      ),
    );
  }, []);
  useEffect(() => {
    exclusive(() => {
      const saved = localRepository.load() ?? freshSave();
      localRepository.save(saved);
      setState(saved);
      setReady(true);
    }).catch((e) =>
      setError(
        `No se pudo cargar el progreso: ${e.message} Puedes reiniciarlo desde Ajustes.`,
      ),
    );
    const sync = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          setState(localRepository.load() ?? freshSave());
        } catch {
          setError("No se pudo leer el progreso de otra pestaña.");
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [exclusive]);
  const act = useCallback(
    (action: Action): Promise<Save | null> => {
      const job = queue.current
        .then(() =>
          exclusive(() => {
            const current = localRepository.load();
            if (!current)
              throw new Error(
                "No hay un guardado disponible. Recarga la página.",
              );
            const next = transition(current, action);
            localRepository.save(next);
            setState(next);
            return next;
          }),
        )
        .catch((e) => {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo guardar. Comprueba el almacenamiento del navegador.",
          );
          return null;
        });
      queue.current = job;
      return job;
    },
    [exclusive],
  );
  const reset = useCallback(async () => {
    try {
      await exclusive(() => {
        const next = freshSave();
        localRepository.save(next);
        setState(next);
        setReady(true);
        setError("");
      });
    } catch {
      setError(
        "El navegador no permite guardar. Habilita LocalStorage para este sitio.",
      );
    }
  }, [exclusive]);
  return (
    <GameContext.Provider
      value={{
        state,
        ready,
        error,
        clearError: () => setError(""),
        act,
        reset,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error("Provider ausente");
  return value;
}
