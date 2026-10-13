import { test, expect, Page } from "@playwright/test";
async function open(page: Page) {
  await page.goto("/");
  await expect(page.locator(".mode-banner")).toContainText("DEMO");
  await expect(
    page.getByRole("button", { name: /Reclamar bonus/ }),
  ).toBeEnabled();
}
async function login(page: Page, original = true) {
  await page.getByRole("button", { name: "Cuenta", exact: true }).click();
  await page
    .getByRole("button", {
      name: original
        ? "Simular cuenta original"
        : "Continuar con Google · DEMO",
    })
    .click();
  if (original)
    await page
      .getByRole("button", { name: "RECLAMAR RECOMPENSA", exact: true })
      .click();
  await expect(page.locator(".game-card-blackjack")).toBeVisible();
}
async function save(page: Page) {
  return page.evaluate(() => {
    const id = localStorage.getItem("gambling:demo:v2:session") ?? "guest";
    return JSON.parse(localStorage.getItem(`gambling:demo:v2:save:${id}`)!);
  });
}
test("original demo reward is once, profile edits persist, public identity and rankings", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Cuenta", exact: true }).click();
  await page.screenshot({ path: "artifacts/v2-auth.png", fullPage: true });
  await page.getByRole("button", { name: "Simular cuenta original" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect.poll(async () => (await save(page)).balance).toBe(10000);
  await page
    .getByRole("button", { name: "RECLAMAR RECOMPENSA", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mi perfil", exact: true })
    .first()
    .click();
  const profile = page.locator(".profile-editor");
  await profile.getByLabel("Nombre de usuario").fill("v2_tester");
  await profile.getByLabel("Biografía").fill("Mi primera noche en el club.");
  await profile.getByRole("button", { name: "Guardar perfil" }).click();
  await expect(profile.getByRole("status")).toContainText("actualizado");
  await page.getByRole("button", { name: "Cambiar avatar" }).click();
  await page.getByRole("button", { name: "Wild Card", exact: true }).click();
  await page.getByRole("button", { name: "Guardar avatar" }).click();
  await expect(
    profile.getByRole("img", { name: "Avatar Wild Card" }),
  ).toBeVisible();
  await profile
    .getByRole("button", { name: "Usuario original de Gambling." })
    .hover();
  await expect(page.getByRole("tooltip")).toHaveText(
    "Usuario original de Gambling.",
  );
  await page.screenshot({ path: "artifacts/v2-profile.png", fullPage: true });
  const href = await profile
    .getByRole("link", { name: "Ver perfil público" })
    .getAttribute("href");
  await profile.getByRole("link", { name: "Ver perfil público" }).click();
  await expect(page.locator(".public-hero h1")).toHaveText("v2_tester");
  await expect(page.locator(".public-hero")).toContainText("Mi primera noche");
  await page.goto("/");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await save(page)).balance).toBe(10000);
  await page
    .getByRole("button", { name: "Rankings", exact: true })
    .first()
    .click();
  await expect(page.locator(".ranking-table")).toContainText("v2_tester");
  await expect(page.locator(".podium-card")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Reaction Test", exact: true })
    .click();
  await expect(page.locator(".ranking-table tbody tr").first()).toContainText(
    "160 ms",
  );
  await page.screenshot({ path: "artifacts/v2-rankings.png", fullPage: true });
  await page
    .getByRole("button", { name: "Mi perfil", exact: true })
    .first()
    .click();
  await expect(
    profile.getByRole("link", { name: "Ver perfil público" }),
  ).toHaveAttribute("href", href!);
  await page.getByRole("button", { name: "Cerrar sesión DEMO" }).click();
  await page.getByRole("button", { name: "Cuenta", exact: true }).click();
  await page.getByRole("button", { name: "Simular cuenta original" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await save(page)).balance).toBe(10000);
});
test("Google demo has no original bonus; production APIs do not accept demo identity", async ({
  page,
  request,
}) => {
  await open(page);
  await login(page, false);
  expect((await save(page)).balance).toBe(5000);
  await expect(
    page.getByRole("button", { name: "Usuario original de Gambling." }),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const denied = await request.get("/api/game");
  expect(denied.ok()).toBe(false);
  const rejected = await request.post("/api/game", {
    data: {
      operationId: crypto.randomUUID(),
      action: { type: "daily" },
      balance: 100000,
    },
    headers: { Origin: "http://localhost:3001" },
  });
  expect(rejected.ok()).toBe(false);
});
test("registration validates confirmation and never stores passwords in demo", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Cuenta", exact: true }).click();
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page
    .getByLabel("Nombre de usuario", { exact: true })
    .fill("registered_demo");
  await page.getByLabel("Correo electrónico").fill("test@example.com");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("StrongPassword123");
  await page.getByLabel("Confirmar contraseña").fill("NotMatching1234");
  await page.getByRole("button", { name: "Mostrar contraseña" }).click();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Crear perfil ficticio" }).click();
  await expect(page.locator(".auth-panel").getByRole("alert")).toContainText(
    "no coinciden",
  );
  await page.getByLabel("Confirmar contraseña").fill("StrongPassword123");
  await page.getByRole("button", { name: "Crear perfil ficticio" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain("StrongPassword123");
  expect(stored).not.toContain("test@example.com");
});
test("jitter stays prepared, counts first click and completes from that click", async ({
  page,
}) => {
  await open(page);
  await page.locator(".game-card-jitter").click();
  await page.getByRole("button", { name: "Comenzar desafío" }).click();
  await expect(
    page.getByRole("heading", { name: "Haz clic para comenzar." }),
  ).toBeVisible();
  await page.waitForTimeout(1200);
  expect((await save(page)).active.prepared).toBe(true);
  await expect(page.locator(".skill-scorebar")).toContainText("10.0");
  await page.getByRole("button", { name: "Área de clics" }).click();
  await expect(page.locator(".skill-scorebar > div").first()).toContainText(
    "1",
  );
  await expect.poll(async () => (await save(page)).active.prepared).toBe(false);
  await expect
    .poll(async () => (await save(page)).active, { timeout: 13000 })
    .toBe(null);
  expect((await save(page)).stats.jitter.best).toBe(1);
});
test("precision first target, sensitivity persistence, focus loss and mobile layouts", async ({
  page,
}) => {
  await open(page);
  await page.locator(".game-card-precision").click();
  await page.getByLabel("Sensibilidad del puntero virtual").fill("2.25");
  await expect
    .poll(async () => (await save(page)).settings.sensitivity)
    .toBe(2.25);
  await page.getByRole("button", { name: "Comenzar desafío" }).click();
  await page.waitForTimeout(1000);
  expect((await save(page)).active.prepared).toBe(true);
  await page.getByRole("button", { name: "Acertar objetivo" }).click();
  await expect(page.locator(".skill-scorebar > div").first()).toContainText(
    "1",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect.poll(async () => (await save(page)).active).toBe(null);
  expect((await save(page)).balance).toBe(5000);
  await page.reload();
  await page.locator(".game-card-precision").click();
  await expect(page.getByLabel("Sensibilidad del puntero virtual")).toHaveValue(
    "2.25",
  );
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Volver al club" }).click();
  await login(page);
  await expect(
    page.getByRole("button", { name: /Reclamar bonus/ }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Rankings", exact: true })
    .first()
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".ranking-table tbody td").nth(2)).toBeVisible();
  await page.screenshot({ path: "artifacts/v2-mobile.png", fullPage: true });
});
test("invalid authentication callback displays an actionable message", async ({
  page,
}) => {
  await page.goto("/auth/callback?next=https://evil.invalid");
  await expect(page).toHaveURL(/auth_error=verification/);
  await expect(page.locator(".form-error")).toContainText("ha caducado");
});
test("captured pointer uses sensitivity, Escape releases, and touch counts one shot", async ({
  page,
  browser,
}) => {
  await open(page);
  await page.locator(".game-card-precision").click();
  await page.getByRole("button", { name: "Comenzar desafío" }).click();
  await page.getByRole("button", { name: "Activar puntero virtual" }).click();
  await expect
    .poll(() => page.evaluate(() => !!document.pointerLockElement))
    .toBe(true);
  expect((await save(page)).active.prepared).toBe(true);
  const move = () =>
    page.evaluate(() => {
      const event = new MouseEvent("mousemove");
      Object.defineProperty(event, "movementX", { value: 10 });
      Object.defineProperty(event, "movementY", { value: 0 });
      document.dispatchEvent(event);
    });
  const left = () =>
    page
      .locator(".virtual-pointer")
      .evaluate((el) => parseFloat((el as HTMLElement).style.left));
  const before = await left();
  await move();
  const delta = (await left()) - before;
  expect(delta).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.evaluate(() => !!document.pointerLockElement))
    .toBe(false);
  await page.getByLabel("Sensibilidad del puntero virtual").fill("2");
  await expect
    .poll(async () => (await save(page)).settings.sensitivity)
    .toBe(2);
  await page.waitForTimeout(1300);
  await page.getByRole("button", { name: "Activar puntero virtual" }).click();
  await expect
    .poll(() => page.evaluate(() => !!document.pointerLockElement))
    .toBe(true);
  const before2 = await left();
  await move();
  expect((await left()) - before2).toBeCloseTo(delta * 2, 2);
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const mobile = await context.newPage();
  await mobile.goto("http://localhost:3001");
  await expect(
    mobile.getByRole("button", { name: /Reclamar bonus/ }),
  ).toBeEnabled();
  await mobile.locator(".game-card-precision").tap();
  await mobile.getByRole("button", { name: "Comenzar desafío" }).tap();
  await mobile.getByRole("button", { name: "Acertar objetivo" }).tap();
  await expect(mobile.locator(".skill-scorebar > div").first()).toContainText(
    "1",
  );
  expect((await save(mobile)).active.prepared).toBe(false);
  await context.close();
});
