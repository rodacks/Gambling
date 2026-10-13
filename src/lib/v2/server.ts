import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function configured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
export function admin() {
  if (!configured())
    throw new HttpError("Configuración de Supabase pendiente.", 503);
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function sessionClient() {
  const store = await cookies();
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    throw new HttpError("Configuración de Supabase pendiente.", 503);
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (values) =>
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          ),
      },
    },
  );
}
export async function requireUser() {
  const client = await sessionClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    throw new HttpError("Inicia sesión para continuar.", 401);
  if (!data.user.email_confirmed_at)
    throw new HttpError("Confirma tu correo antes de jugar online.", 403);
  return data.user;
}
export async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError("Se requiere JSON.", 415);
  const url = new URL(request.url);
  // Next may use its bind address internally. Host is the public request authority.
  const authority = request.headers.get("host") ?? url.host;
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    url.protocol.replace(":", "");
  if (request.headers.get("origin") !== `${protocol}://${authority}`)
    throw new HttpError("Origen no permitido.", 403);
  const text = await request.text();
  if (text.length > 100000)
    throw new HttpError("Solicitud demasiado grande.", 413);
  return JSON.parse(text);
}
export function respond(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return respond({ error: error.message }, error.status);
  const e = error as {
    issues?: { message: string }[];
    message?: string;
    code?: string;
  };
  if (e.code === "23505")
    return respond(
      { error: "Ese nombre o identificador ya está utilizado." },
      409,
    );
  if (e.issues)
    return respond(
      { error: "Solicitud inválida: " + e.issues[0]?.message },
      400,
    );
  return respond(
    {
      error: e.message?.includes("Configuración")
        ? e.message
        : "No se pudo completar la operación. Comprueba los datos y vuelve a intentarlo.",
    },
    400,
  );
}
export async function rateLimit(user: string, scope = "game", limit = 90) {
  const { data, error } = await admin().rpc("gambling_rate_limit", {
    p_user: user,
    p_scope: scope,
    p_limit: limit,
  });
  if (error) throw error;
  if (!data)
    throw new HttpError("Demasiadas solicitudes. Espera un minuto.", 429);
}
