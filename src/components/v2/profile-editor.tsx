"use client";
import { useState } from "react";
import Link from "next/link";
import { Pencil, ExternalLink, Link2, LogOut } from "lucide-react";
import { useAccount } from "./account";
import { Avatar, AvatarPicker, OriginalBadge } from "./identity";
import { authClient } from "@/lib/v2/client";
export function ProfileEditor() {
  const { member, mode, saveProfile, logout } = useAccount();
  const [username, setUsername] = useState(member?.username ?? ""),
    [bio, setBio] = useState(member?.bio ?? ""),
    [picker, setPicker] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  if (!member)
    return (
      <div className="panel">
        <h3>Tu perfil online está por estrenar.</h3>
        <p>
          Entra desde «Cuenta» para usar avatares, biografía y perfil público.
          Tu partida local sigue separada de los rankings.
        </p>
      </div>
    );
  return (
    <section className="panel profile-editor">
      <div className="editable-identity">
        <button
          className="edit-avatar"
          onClick={() => setPicker(true)}
          aria-label="Cambiar avatar"
        >
          <Avatar id={member.avatar} size={82} />
          <Pencil size={14} />
        </button>
        <div>
          <div className="identity-name">
            <h2>{member.username}</h2>
            {member.original && <OriginalBadge />}
          </div>
          <p>{member.bio || "Dale personalidad a tu perfil."}</p>
          <Link href={`/players/${member.id}`} className="text-link">
            Ver perfil público <ExternalLink size={13} />
          </Link>
        </div>
        <span className="mode-chip">
          {mode === "demo" ? "PERFIL DEMO" : "CUENTA GAMBLING"}
        </span>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            await saveProfile({ username, bio, avatar: member.avatar });
            setMessage("Perfil actualizado.");
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="profile-fields">
          <label>
            Nombre de usuario
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              required
              minLength={3}
            />
            <small>3–20 letras, números o guion bajo. Debe ser único.</small>
          </label>
          <label>
            Biografía
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={150}
              rows={2}
            />
            <small>{bio.length}/150 · Solo texto</small>
          </label>
        </div>
        <div className="editor-actions">
          <button className="button gold" disabled={busy}>
            Guardar perfil
          </button>
          <span role="status">{message}</span>
        </div>
      </form>
      <div className="account-actions">
        {mode === "online" && (
          <button
            className="button secondary"
            onClick={async () => {
              try {
                const { error } = await authClient().auth.linkIdentity({
                  provider: "google",
                  options: { redirectTo: `${location.origin}/auth/callback` },
                });
                if (error) throw error;
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            <Link2 size={15} /> Vincular Google
          </button>
        )}
        <button
          className="button secondary"
          onClick={() => void logout().catch((e) => setMessage(e.message))}
        >
          <LogOut size={15} /> Cerrar sesión{mode === "demo" ? " DEMO" : ""}
        </button>
      </div>
      {picker && (
        <AvatarPicker
          value={member.avatar}
          onClose={() => setPicker(false)}
          onSave={(avatar) =>
            saveProfile({ username: member.username, bio: member.bio, avatar })
          }
        />
      )}
    </section>
  );
}
