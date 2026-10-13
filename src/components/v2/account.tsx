"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { APP_MODE } from "@/lib/v2/config";
import {
  Member,
  ProfileEdit,
  profileSchema,
  PublicPlayer,
} from "@/lib/v2/profile";
import { api, authClient } from "@/lib/v2/client";
import {
  createDemo,
  DEMO_SESSION,
  demoMembers,
  editDemo,
  putMember,
} from "@/lib/v2/demo";
type AccountContext = {
  mode: typeof APP_MODE;
  member: Member | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  saveProfile: (p: ProfileEdit) => Promise<void>;
  logout: () => Promise<void>;
  demoLogin: (original: boolean, username?: string) => void;
  acknowledge: () => Promise<void>;
};
const Context = createContext<AccountContext | null>(null);
export function AccountProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      if (APP_MODE === "demo") {
        const id = localStorage.getItem(DEMO_SESSION);
        setMember(demoMembers().find((m) => m.id === id) ?? null);
      } else if (APP_MODE === "online") {
        const result = await api<{ member: Member | null }>("/api/account");
        setMember(result.member);
      }
      setError(
        new URLSearchParams(location.search).has("auth_error")
          ? "El enlace de acceso no es válido o ha caducado. Solicita un nuevo correo o vuelve a iniciar sesión."
          : "",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const sync = () => void refresh();
    window.addEventListener("storage", sync);
    window.addEventListener("demo-update", sync);
    let unsubscribe = () => {};
    if (APP_MODE === "online") {
      const { data } = authClient().auth.onAuthStateChange(() => {
        setTimeout(() => void refresh(), 0);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    }
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("demo-update", sync);
      unsubscribe();
    };
  }, [refresh]);
  const demoLogin = (original: boolean, username?: string) => {
    if (APP_MODE !== "demo") throw new Error("DEMO deshabilitada.");
    const existing = !username
      ? demoMembers().find((p) => p.original === original)
      : undefined;
    const next =
      existing ??
      createDemo(
        username ??
          `demo_${original ? "original" : "google"}_${crypto.randomUUID().slice(0, 5)}`,
        original,
      );
    localStorage.setItem(DEMO_SESSION, next.id);
    setMember(next);
  };
  const saveProfile = async (edit: ProfileEdit) => {
    const clean = profileSchema.parse(edit);
    if (!member) throw new Error("Inicia sesión para personalizar tu perfil.");
    if (APP_MODE === "demo") setMember(editDemo(member, clean));
    else {
      await api("/api/account", clean, "PATCH");
      await refresh();
    }
  };
  const logout = async () => {
    if (APP_MODE === "online") {
      const { error } = await authClient().auth.signOut();
      if (error) throw error;
    } else localStorage.removeItem(DEMO_SESSION);
    setMember(null);
  };
  const acknowledge = async () => {
    if (!member) return;
    if (APP_MODE === "demo") {
      const next = { ...member, welcomePending: false };
      putMember(next);
      setMember(next);
    } else {
      await api("/api/account", { acknowledge: true });
      await refresh();
    }
  };
  return (
    <Context.Provider
      value={{
        mode: APP_MODE,
        member,
        loading,
        error,
        refresh,
        saveProfile,
        logout,
        demoLogin,
        acknowledge,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAccount() {
  const c = useContext(Context);
  if (!c) throw new Error("AccountProvider ausente");
  return c;
}
export function memberFromPublic(p: PublicPlayer): Member {
  return { ...p, welcomePending: false };
}
