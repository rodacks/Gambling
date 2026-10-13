import { admin, failure, respond } from "@/lib/v2/server";
import { usernameSchema } from "@/lib/v2/profile";
export async function GET(request: Request) {
  try {
    const name = usernameSchema.parse(
      new URL(request.url).searchParams.get("username"),
    );
    const { data, error } = await admin()
      .from("public_players")
      .select("id")
      .eq("username", name)
      .limit(1);
    if (error) throw error;
    return respond({ available: data.length === 0 });
  } catch (e) {
    return failure(e);
  }
}
