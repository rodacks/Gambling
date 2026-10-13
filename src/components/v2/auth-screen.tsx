"use client";
import { useState } from "react";
import { Eye, EyeOff, ShieldCheck, Mail, ArrowRight } from "lucide-react";
import { useAccount } from "./account";
import { api, authClient } from "@/lib/v2/client";
import { passwordSchema, signupSchema } from "@/lib/v2/profile";
type FormMode = "login" | "register" | "recover" | "reset";
export function AuthScreen({
  initial = "login",
  onDone,
}: {
  initial?: FormMode;
  onDone?: () => void;
}) {
  const { mode, refresh, demoLogin } = useAccount();
  const [form, setForm] = useState<FormMode>(initial),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [username, setUsername] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      if (form === "register") {
        const clean = signupSchema.parse({
          username,
          email,
          password,
          confirm,
        });
        if (mode === "demo") {
          demoLogin(true, clean.username);
          setPassword("");
          setConfirm("");
          onDone?.();
          return;
        }
        if (mode !== "online")
          throw new Error(
            "Configuración pendiente. Usa npm run dev:demo para probar sin Supabase.",
          );
        const { available } = await api<{ available: boolean }>(
          `/api/public/availability?username=${encodeURIComponent(clean.username)}`,
        );
        if (!available)
          throw new Error("El nombre de usuario ya está ocupado.");
        const { error } = await authClient().auth.signUp({
          email: clean.email,
          password: clean.password,
          options: {
            data: { username: clean.username },
            emailRedirectTo: `${location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setPassword("");
        setConfirm("");
        setMessage(
          "Revisa tu correo y confirma la cuenta. Si ya existe una cuenta con ese correo, inicia sesión o recupera la contraseña.",
        );
      } else if (form === "login") {
        if (mode === "demo") {
          setMessage(
            "La DEMO no valida contraseñas. Elige una de las sesiones ficticias de abajo.",
          );
          setPassword("");
          return;
        }
        if (mode !== "online")
          throw new Error("Supabase todavía no está configurado.");
        const { error } = await authClient().auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        await refresh();
        onDone?.();
      } else if (form === "recover") {
        if (mode !== "online") {
          setMessage(
            "Demostración: no se envió ningún correo. Configura Supabase y SMTP para usar este flujo.",
          );
          return;
        }
        const { error } = await authClient().auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth/callback?next=/auth/reset`,
        });
        if (error) throw error;
        setMessage(
          "Si ese correo tiene una cuenta, recibirás un enlace de recuperación.",
        );
      } else {
        passwordSchema.parse(password);
        if (password !== confirm)
          throw new Error("Las contraseñas no coinciden.");
        if (mode !== "online")
          throw new Error(
            "El cambio de contraseña requiere una sesión real de Supabase.",
          );
        const { error } = await authClient().auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        setConfirm("");
        setMessage("Contraseña actualizada. Puedes volver al club.");
      }
    } catch (e) {
      const err = e as { issues?: { message: string }[]; message?: string };
      setError(
        err.issues?.[0]?.message ??
          (err.message === "Invalid login credentials"
            ? "Correo o contraseña incorrectos."
            : err.message === "Email not confirmed"
              ? "Confirma tu correo antes de iniciar sesión."
              : (err.message ?? "No se pudo completar la solicitud.")),
      );
    } finally {
      setBusy(false);
    }
  };
  const google = async () => {
    setBusy(true);
    setError("");
    try {
      if (mode === "demo") {
        demoLogin(false);
        onDone?.();
        return;
      }
      if (mode !== "online")
        throw new Error(
          "Google OAuth requiere configurar Supabase y Google Cloud.",
        );
      const { error } = await authClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-layout">
      <div className="auth-intro">
        <span className="eyebrow">GAMBLING / MEMBERS CLUB</span>
        <h1>
          Tu próxima
          <br />
          gran jugada<span>.</span>
        </h1>
        <p>Un perfil. Todos tus juegos. Tu progreso contigo.</p>
        <div className="auth-perk">
          <ShieldCheck />
          <div>
            <b>Cuenta original GAMBLING</b>
            <p>
              Insignia dorada y 5.000 GAMBLINGS extra tras verificar el correo.
              Una sola vez.
            </p>
          </div>
        </div>
        <p className="fine-print">
          Todas las monedas son virtuales. Los niveles nunca cambian las
          probabilidades.
        </p>
      </div>
      <section className="panel auth-panel">
        <div className="v2-tabs">
          {[
            ["login", "Entrar"],
            ["register", "Crear cuenta"],
          ].map(([m, t]) => (
            <button
              key={m}
              className={form === m ? "active" : ""}
              onClick={() => {
                setForm(m as FormMode);
                setError("");
                setMessage("");
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <h2>
          {form === "register"
            ? "Hazlo tuyo."
            : form === "recover"
              ? "Recupera tu cuenta."
              : form === "reset"
                ? "Nueva contraseña."
                : "Bienvenido de vuelta."}
        </h2>
        {mode === "demo" && (
          <p className="demo-note">
            DEMO · Sin autenticación real. No introduzcas contraseñas reales. No
            se almacenan ni se envían contraseñas.
          </p>
        )}
        {mode === "local" && (
          <p className="demo-note">
            Funciones online pendientes de configuración. Tu partida local sigue
            disponible. Para explorar perfiles ficticios:{" "}
            <code>npm run dev:demo</code>.
          </p>
        )}
        <form onSubmit={submit}>
          {form === "register" && (
            <label>
              Nombre de usuario
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={20}
                autoComplete="username"
              />
            </label>
          )}
          {form !== "reset" && (
            <label>
              Correo electrónico
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
          )}
          {form !== "recover" && (
            <>
              <label>
                Contraseña
                <div className="password-field">
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={
                      form === "login" ? "current-password" : "new-password"
                    }
                    minLength={form === "login" ? 1 : 12}
                  />
                  <button
                    type="button"
                    aria-label={
                      show ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              {form !== "login" && (
                <>
                  <small className="fine-print">
                    12 caracteres como mínimo, con mayúsculas, minúsculas y
                    números.
                  </small>
                  <label>
                    Confirmar contraseña
                    <input
                      type={show ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </label>
                </>
              )}
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="form-success" role="status">
              {message}
            </p>
          )}
          <button className="button gold wide" disabled={busy}>
            {busy
              ? "Un momento…"
              : form === "register"
                ? mode === "demo"
                  ? "Crear perfil ficticio"
                  : "Crear cuenta GAMBLING"
                : form === "recover"
                  ? "Enviar enlace"
                  : form === "reset"
                    ? "Actualizar contraseña"
                    : "Iniciar sesión"}
            <ArrowRight size={15} />
          </button>
        </form>
        {form === "login" && (
          <button className="text-link" onClick={() => setForm("recover")}>
            Olvidé mi contraseña
          </button>
        )}
        {form !== "reset" && (
          <>
            <div className="auth-divider">o</div>
            <button
              className="button secondary wide google-button"
              disabled={busy}
              onClick={() => void google()}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4h5.4c-.3 1.3-1 2.4-2.1 3.1-1 .7-2.1 1.1-3.3 1.1A6.2 6.2 0 1 1 16.1 7l3-3A10.3 10.3 0 1 0 12 22.3c6 0 9.6-4.2 9.6-10.1Z"
                />
              </svg>
              Continuar con Google{mode === "demo" ? " · DEMO" : ""}
            </button>
          </>
        )}
        {mode === "demo" && (
          <button
            className="button secondary wide demo-original"
            disabled={busy}
            onClick={() => {
              demoLogin(true);
              onDone?.();
            }}
          >
            <Mail size={16} /> Simular cuenta original
          </button>
        )}
      </section>
    </div>
  );
}
