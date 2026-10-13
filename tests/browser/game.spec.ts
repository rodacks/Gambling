import { test, expect, Page } from "@playwright/test";
const save = (p: Page) =>
  p.evaluate(() => JSON.parse(localStorage.getItem("gambling:v1")!));
async function open(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Reclamar bonus/ }),
  ).toBeEnabled();
}
async function game(page: Page, name: string) {
  await page.getByRole("button", { name }).click();
}
test("lobby, daily bonus, profile and persistence", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  expect((await save(page)).balance).toBe(5000);
  await page.screenshot({
    path: "artifacts/lobby-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Reclamar bonus/ }).click();
  await expect(
    page.getByRole("button", { name: /Próximo bonus/ }),
  ).toBeDisabled();
  expect((await save(page)).balance).toBe(10000);
  await page
    .getByRole("button", { name: "Mi perfil", exact: true })
    .first()
    .click();
  await page.getByLabel("Nombre del jugador").fill("Club Tester");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect.poll(async () => (await save(page)).name).toBe("Club Tester");
  await page.reload();
  await expect.poll(async () => (await save(page)).name).toBe("Club Tester");
  expect((await save(page)).balance).toBe(10000);
  expect(errors).toEqual([]);
});
test("blackjack plays and persists an active hand", async ({ page }) => {
  await open(page);
  await game(
    page,
    "EL CLÁSICO Blackjack Una buena mano lo cambia todo. ♠ Hasta 3:2 JUGAR AHORA",
  );
  await page.getByRole("button", { name: "Repartir cartas" }).click();
  await expect
    .poll(
      async () =>
        !!(await save(page)).active || (await save(page)).history.length === 1,
    )
    .toBe(true);
  if ((await save(page)).active) {
    await page.reload();
    await expect(page.getByRole("button", { name: "Plantarse" })).toBeVisible();
    if (await page.getByRole("button", { name: "Plantarse" }).isEnabled())
      await page.getByRole("button", { name: "Plantarse" }).click();
  }
  await expect.poll(async () => (await save(page)).history.length).toBe(1);
  const s = await save(page);
  expect(s.active).toBe(null);
  expect(s.balance).toBe(5000 + s.history[0].net);
  await page.screenshot({ path: "artifacts/blackjack.png", fullPage: true });
});
test("race completes once and visually agrees with ranking", async ({
  page,
}) => {
  await open(page);
  await page.locator(".game-card-racing").click();
  await page.getByRole("button", { name: "Acelerar" }).click();
  await expect.poll(async () => (await save(page)).active?.game).toBe("racing");
  const r = (await save(page)).active;
  await page.screenshot({ path: "artifacts/racing.png", fullPage: true });
  await expect
    .poll(async () => (await save(page)).active, { timeout: 15000 })
    .toBe(null);
  const s = await save(page);
  expect(s.history).toHaveLength(1);
  expect(s.history[0].label).toContain(
    [
      "Gold Rush",
      "Neon Ghost",
      "Redline",
      "Mint Condition",
      "Blue Comet",
      "Wild Card",
    ][r.order[0]],
  );
  expect(await page.locator(".finish-rank").allTextContents()).toHaveLength(6);
  expect(s.balance).toBe(5000 + s.history[0].net);
});
test("roulette bets, undo, animation and payout", async ({ page }) => {
  await open(page);
  await page.locator(".game-card-roulette").click();
  await page.getByRole("button", { name: "◆ ROJO", exact: true }).click();
  await page.getByRole("button", { name: "PAR", exact: true }).click();
  await page.getByRole("button", { name: "Deshacer última ficha" }).click();
  await expect(page.locator(".bet-summary")).toContainText("100");
  await page.getByRole("button", { name: "Girar la ruleta" }).click();
  await expect
    .poll(async () => (await save(page)).active?.game)
    .toBe("roulette");
  await expect(page.getByRole("button", { name: "Girando…" })).toBeDisabled();
  await expect
    .poll(async () => (await save(page)).active, { timeout: 10000 })
    .toBe(null);
  expect((await save(page)).history).toHaveLength(1);
  await page.screenshot({ path: "artifacts/roulette.png", fullPage: true });
});
test("jitter rewards, false-start reaction, precision hit/miss", async ({
  page,
}) => {
  await open(page);
  await page.locator(".game-card-jitter").click();
  await page.getByRole("button", { name: "Comenzar desafío" }).click();
  const arena = page.getByRole("button", { name: "Área de clics" });
  for (let i = 0; i < 22; i++)
    await arena.dispatchEvent("pointerdown", { button: 0 });
  await expect
    .poll(async () => (await save(page)).active, { timeout: 15000 })
    .toBe(null);
  expect((await save(page)).stats.jitter.best).toBe(22);
  expect((await save(page)).balance).toBe(5120);
  await page.getByRole("button", { name: "Volver al club" }).click();
  await page.locator(".game-card-reaction").click();
  await page.getByRole("button", { name: "Comenzar desafío" }).click();
  await page
    .getByRole("button", { name: "Pulsa cuando aparezca verde" })
    .click();
  await expect(page.getByRole("status")).toContainText("Salida anticipada");
  expect((await save(page)).stats.reaction.best).toBe(0);
  await page.getByRole("button", { name: "Volver al club" }).click();
  await page.locator(".game-card-precision").click();
  await page.getByRole("button", { name: "Comenzar desafío" }).click();
  for (let i = 0; i < 10; i++)
    await page
      .getByRole("button", { name: "Acertar objetivo" })
      .dispatchEvent("pointerdown", { button: 0 });
  await page
    .getByRole("group", { name: "Área de precisión" })
    .dispatchEvent("pointerdown", { button: 0 });
  await expect
    .poll(async () => (await save(page)).active, { timeout: 25000 })
    .toBe(null);
  expect((await save(page)).stats.precision.best).toBe(9);
  expect((await save(page)).stats.precision.earned).toBe(120);
});
test("two tabs cannot duplicate the daily bonus or reserve two races", async ({
  page,
  context,
}) => {
  await open(page);
  const other = await context.newPage();
  await open(other);
  await Promise.all([
    page
      .getByRole("button", { name: /Reclamar bonus/ })
      .evaluate((b: HTMLButtonElement) => b.click()),
    other
      .getByRole("button", { name: /Reclamar bonus/ })
      .evaluate((b: HTMLButtonElement) => b.click()),
  ]);
  await expect.poll(async () => (await save(page)).balance).toBe(10000);
  expect(
    (await save(page)).ledger.filter(
      (m: { label: string }) => m.label === "Bonificación diaria",
    ),
  ).toHaveLength(1);
  await page.locator(".game-card-racing").click();
  await other.locator(".game-card-racing").click();
  await Promise.all([
    page
      .getByRole("button", { name: "Acelerar" })
      .evaluate((b: HTMLButtonElement) => b.click()),
    other
      .getByRole("button", { name: "Acelerar" })
      .evaluate((b: HTMLButtonElement) => b.click()),
  ]);
  await expect.poll(async () => (await save(page)).balance).toBe(9900);
  expect(
    (await save(page)).ledger.filter(
      (m: { label: string }) => m.label === "Apuesta reservada",
    ),
  ).toHaveLength(1);
});
test("mobile layout and reset confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.screenshot({ path: "artifacts/lobby-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".game-card-racing").click();
  await expect(
    page.getByRole("heading", { name: "Midnight Run.", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/racing-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Volver al club" }).click();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Ajustes" })
    .click();
  await page
    .getByRole("button", { name: "Reiniciar progreso", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Cancelar", exact: true })
    .last()
    .click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reiniciar progreso", exact: true })
    .click();
  await page.getByRole("button", { name: "Sí, reiniciar" }).click();
  await expect(
    page.getByRole("heading", { name: "Bienvenido al club." }),
  ).toBeVisible();
  expect((await save(page)).balance).toBe(5000);
});
test("touch screens fit at 360px, reaction succeeds, settings persist", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  for (const g of [
    "blackjack",
    "racing",
    "roulette",
    "jitter",
    "reaction",
    "precision",
  ]) {
    await page.locator(`.game-card-${g}`).tap();
    await expect(page.locator(".game-page-header h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/${g}-360.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Volver al club" }).tap();
    await page
      .locator(".mobile-nav")
      .getByRole("button", { name: "El club", exact: true })
      .tap();
    await expect(
      page.getByRole("heading", { name: "Bienvenido al club." }),
    ).toBeVisible();
  }
  await page.locator(".game-card-blackjack").tap();
  await page.getByRole("button", { name: "Repartir cartas" }).tap();
  await expect
    .poll(
      async () =>
        !!(await save(page)).active || (await save(page)).history.length === 1,
    )
    .toBe(true);
  if ((await save(page)).active) {
    const stand = page.getByRole("button", { name: "Plantarse" });
    await expect(stand).toBeInViewport();
    if (await stand.isEnabled()) await stand.tap();
  }
  await expect.poll(async () => (await save(page)).active).toBe(null);
  await page.getByRole("button", { name: "Volver al club" }).tap();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "El club", exact: true })
    .tap();
  await page.locator(".game-card-reaction").tap();
  await page.getByRole("button", { name: "Comenzar desafío" }).tap();
  await expect(
    page.getByRole("button", { name: "Pulsa cuando aparezca verde" }),
  ).toBeInViewport();
  await expect(page.getByRole("heading", { name: "¡AHORA!" })).toBeVisible({
    timeout: 7000,
  });
  await page.getByRole("button", { name: "Pulsa cuando aparezca verde" }).tap();
  await expect
    .poll(async () => (await save(page)).stats.reaction.best)
    .toBeGreaterThan(0);
  expect((await save(page)).history[0].label).not.toContain("anticipada");
  await page.getByRole("button", { name: "Volver al club" }).tap();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Ajustes" })
    .tap();
  await page.getByRole("switch", { name: "Reducir animaciones" }).tap();
  await page.getByRole("switch", { name: "Activar sonido" }).tap();
  await page.reload();
  expect((await save(page)).settings).toEqual({
    sound: false,
    reducedMotion: true,
  });
  expect(errors).toEqual([]);
  await context.close();
});
test("corrupt saves are recoverable without being silently overwritten", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("gambling:v1", "invalid-json"),
  );
  await page.reload();
  await expect(page.locator(".error-banner")).toContainText(
    "No se pudo cargar",
  );
  expect(await page.evaluate(() => localStorage.getItem("gambling:v1"))).toBe(
    "invalid-json",
  );
  await page
    .locator(".sidebar-bottom")
    .getByRole("button", { name: "Ajustes" })
    .click();
  await page
    .getByRole("button", { name: "Reiniciar progreso", exact: true })
    .click();
  await page.getByRole("button", { name: "Sí, reiniciar" }).click();
  await expect.poll(async () => (await save(page)).balance).toBe(5000);
  await expect(page.locator(".error-banner")).toHaveCount(0);
});
