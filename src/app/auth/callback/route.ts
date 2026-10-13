import { sessionClient } from "@/lib/v2/server";
export async function GET(request: Request) {
  const url = new URL(request.url),
    code = url.searchParams.get("code"),
    token = url.searchParams.get("token_hash"),
    type = url.searchParams.get("type");
  const next =
    url.searchParams.get("next") === "/auth/reset" ? "/auth/reset" : "/";
  try {
    const client = await sessionClient();
    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (token && ["signup", "recovery", "email"].includes(type ?? "")) {
      const { error } = await client.auth.verifyOtp({
        token_hash: token,
        type: type as "signup" | "recovery" | "email",
      });
      if (error) throw error;
    } else throw new Error("Missing token");
    return new Response(null, {
      status: 303,
      headers: {
        Location: type === "recovery" ? "/auth/reset" : next,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/?auth_error=verification",
        "Cache-Control": "no-store",
      },
    });
  }
}
