import { beforeEach, describe, it, expect, vi } from "vitest";
const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));
import {
  requireUser,
  readBody,
  HttpError,
  configured,
  failure,
} from "../src/lib/v2/server";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "private-test-key");
  getUser.mockReset();
});
describe("Private API authentication boundary (SDK mocked, no live Auth claim)", () => {
  it("requires verified Supabase identity, never accepts anonymous or expired sessions", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
    getUser.mockResolvedValue({
      data: { user: { id: "forged" } },
      error: { message: "expired" },
    });
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
  it("refuses unconfirmed email and returns provider-verified identity", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "auth-id", email_confirmed_at: null } },
      error: null,
    });
    await expect(requireUser()).rejects.toMatchObject({ status: 403 });
    getUser.mockResolvedValue({
      data: { user: { id: "auth-id", email_confirmed_at: "2026-10-01" } },
      error: null,
    });
    expect((await requireUser()).id).toBe("auth-id");
    expect(getUser).toHaveBeenCalledTimes(2);
  });
  it("fails closed when public or server credentials are absent", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(configured()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    await expect(requireUser()).rejects.toMatchObject({ status: 503 });
  });
  it("enforces JSON, exact same origin and a bounded request body", async () => {
    const make = (origin: string, body = "{}", type = "application/json") =>
      new Request("https://club.example/api/game", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": type },
        body,
      });
    await expect(readBody(make("https://club.example"))).resolves.toEqual({});
    await expect(
      readBody(make("https://attacker.example")),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      readBody(make("https://club.example", "{}", "text/plain")),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      readBody(make("https://club.example", "x".repeat(100001))),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("responses never leak internal database errors or service secrets", async () => {
    const response = failure(new Error("private-test-key database-password"));
    expect(await response.text()).not.toContain("private-test-key");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(failure(new HttpError("Inicia sesión", 401)).status).toBe(401);
  });
  it("accepts the public Host when Next binds internally to 0.0.0.0", async () => {
    const request = new Request("http://0.0.0.0:3000/api/game", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    await expect(readBody(request)).resolves.toEqual({});
  });
});
