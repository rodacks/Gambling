import { admin, failure, respond } from "@/lib/v2/server";
import { z } from "zod";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await params).id);
    const { data, error } = await admin()
      .from("public_players")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return respond({ error: "Este perfil no existe." }, 404);
    return respond(data);
  } catch (e) {
    return failure(e);
  }
}
