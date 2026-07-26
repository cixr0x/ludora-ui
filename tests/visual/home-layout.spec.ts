import { expect, test, type Page } from "@playwright/test";

const svgCover = (label: string, background: string, width = 320, height = 320) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" rx="12" fill="${background}" />
      <circle cx="${width * 0.75}" cy="${height * 0.25}" r="${Math.min(width, height) * 0.16}" fill="rgba(255,255,255,0.2)" />
      <text x="50%" y="54%" fill="white" font-family="Arial, sans-serif" font-size="${Math.min(width, height) * 0.13}" font-weight="700" text-anchor="middle">${label}</text>
    </svg>
  `)}`;

const game = (
  id: number,
  name: string,
  background: string,
  width = 320,
  height = 320,
) => ({
  id,
  canonical_name: name,
  image_url: svgCover(name, background, width, height),
});

const frontPageRows = [
  {
    id: 1,
    category_type: "category",
    category_id: 1,
    category_name: "Party Game",
    title: "Party Game",
    order: 1,
    products: [
      game(101, "Fiesta", "#a21caf", 240, 320),
      game(102, "Color", "#0f766e"),
      game(103, "Ritmo", "#c2410c", 360, 240),
      game(104, "Risas", "#1d4ed8"),
      game(105, "Mímica", "#7e22ce", 240, 320),
    ],
  },
  {
    id: 2,
    category_type: "category",
    category_id: 2,
    category_name: "Cooperative",
    category_name_es: "Cooperativos",
    title: "Cooperative",
    title_display: "Cooperativos",
    order: 2,
    products: [
      game(201, "Equipo", "#0369a1", 360, 240),
      game(202, "Rescate", "#be123c", 240, 320),
      game(203, "Misión", "#4d7c0f"),
      game(204, "Alianza", "#6d28d9", 360, 240),
      game(205, "Juntos", "#b45309"),
    ],
  },
  {
    id: 3,
    category_type: "category",
    category_id: 3,
    category_name: "Strategy",
    category_name_es: "Estrategia",
    title: "Strategy",
    title_display: "Estrategia",
    order: 3,
    products: [
      game(301, "Reinos", "#4338ca"),
      game(302, "Mercado", "#047857", 240, 320),
      game(303, "Imperio", "#b91c1c", 360, 240),
      game(304, "Ciudad", "#a16207"),
      game(305, "Conquista", "#475569"),
    ],
  },
];

async function mockCatalog(page: Page) {
  await page.route("https://ludora.s3.us-east-2.amazonaws.com/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" />',
    }),
  );
  await page.route("**/api/front-page", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: frontPageRows }),
    }),
  );
  await page.route("**/api/items/filter-options", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          categories: [
            { id: 1, name: "Party Game", name_es: "Fiesta" },
            { id: 2, name: "Cooperative", name_es: "Cooperativos" },
            { id: 3, name: "Strategy", name_es: "Estrategia" },
          ],
          mechanics: [],
        },
      }),
    }),
  );
}

test("home catalog keeps its responsive visual layout", async ({ page }) => {
  await mockCatalog(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const renderedRows = page.locator('[data-row-image-status="visible"]');
  await expect(renderedRows).toHaveCount(frontPageRows.length);

  for (let index = 0; index < frontPageRows.length; index += 1) {
    await expect(renderedRows.nth(index)).toHaveAttribute("data-row-pending-visible-count", "0");
  }

  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("home-catalog.png", {
    animations: "disabled",
    caret: "hide",
    scale: "css",
  });
});
