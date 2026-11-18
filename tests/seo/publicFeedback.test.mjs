import assert from "node:assert/strict";
import test from "node:test";
import { chromium, expect } from "@playwright/test";
import { startFixtureServer } from "./fixture-server.mjs";

const origin = "http://127.0.0.1:5175";
const correctionTitle = "Reportar información incorrecta";
const correctionSubtitle = "Datos de juegos, precios, tiendas o enlaces.";
const gameStarter = "Encontré el siguiente error sobre el juego «Dixit» (ID 851):\n";
const genericStarter = "La información que encontré incorrecta es:\n";

test("site-wide feedback sends the selected category and keeps a failed correction editable", { timeout: 60000 }, async () => {
  const server = await startFixtureServer();
  try {
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
      const submissions = [];
      let releaseFirstResponse;
      const firstResponse = new Promise(resolve => { releaseFirstResponse = resolve; });
      await page.route(url => url.pathname === "/api/contact", async route => {
        const request = route.request();
        assert.equal(request.method(), "POST");
        submissions.push(request.postDataJSON());
        if (submissions.length === 1) {
          await firstResponse;
          await route.fulfill({ status: 503, json: { error: "Unavailable" } });
        } else {
          await route.fulfill({ status: 201, json: { data: { id: submissions.length } } });
        }
      });
      await page.goto(`${origin}/game/851/dixit`);
      const trigger = page.getByRole("button", { name: "Ayúdanos a mejorar" });
      const dialog = page.getByRole("dialog");
      const message = dialog.getByRole("textbox", { name: "Mensaje" });
      const submit = dialog.getByRole("button", { name: "Enviar", exact: true });
      const success = dialog.getByRole("heading", { name: "Mensaje enviado", exact: true });

      async function selectOption(title, subtitle, starter) {
        await expect(dialog).toHaveAccessibleName("Ayúdanos a mejorar");
        const choice = dialog.getByRole("button", { name: new RegExp(title) });
        await expect(choice.getByText(subtitle, { exact: true })).toBeVisible();
        await choice.press("Enter");
        await expect(dialog).toHaveAccessibleName(title);
        await expect(dialog).toHaveAccessibleDescription(subtitle);
        await expect(message).toBeFocused();
        await expect(message).toHaveJSProperty("value", starter);
        await expect(message).toHaveJSProperty("selectionStart", starter.length);
        await expect(message).toHaveJSProperty("selectionEnd", starter.length);
      }

      async function expectFeedbackConfirmation(title, subtitle) {
        await expect(success).toBeVisible();
        await expect(dialog).toHaveAccessibleName("Mensaje enviado");
        await expect(dialog).toHaveAccessibleDescription("¡Gracias por ayudarnos a mejorar Ludo Radar!");
        await expect(dialog).toBeFocused();
        await expect(dialog.getByText(title, { exact: true })).toHaveCount(0);
        await expect(dialog.getByText(subtitle, { exact: true })).toHaveCount(0);
        await expect(dialog.getByRole("status")).toHaveCount(0);
        await expect(message).toHaveCount(0);
        await expect(dialog.getByRole("button")).toHaveCount(1);
        await expect(dialog.getByRole("button", { name: "Cerrar", exact: true })).toBeEnabled();
      }

      await expect(trigger).toBeVisible();
      await expect(page.getByRole("heading", { name: "Dixit", exact: true })).toBeVisible();
      await trigger.press("Enter");
      await selectOption(correctionTitle, correctionSubtitle, gameStarter);
      await message.pressSequentially("El enlace no funciona.");
      const correction = { name: "Ludo Radar", email: "correccion@ludoradar.mx", message: `${gameStarter}El enlace no funciona.` };
      const back = dialog.getByRole("button", { name: "Volver", exact: true });
      const close = dialog.getByRole("button", { name: "Cerrar", exact: true });
      try {
        await submit.evaluate(button => {
          button.form.requestSubmit(button);
          button.form.requestSubmit(button);
        });
        await expect.poll(() => submissions.length).toBe(1);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveAttribute("data-state", "open");
        await page.mouse.click(1, 1);
        await expect(dialog).toHaveAttribute("data-state", "open");
        await expect(back).toBeDisabled();
        await expect(close).toBeDisabled();
        await expect(dialog.getByRole("button", { name: "Enviando…" })).toBeDisabled();
        await expect(message).toHaveValue(correction.message);
        await expect(success).toHaveCount(0);
        await message.evaluate(element => element.form.requestSubmit());
      } finally {
        releaseFirstResponse();
      }
      await expect(dialog.getByRole("alert")).toHaveText("No pudimos enviar el mensaje. Intenta de nuevo.");
      await expect(success).toHaveCount(0);
      await expect(message).toHaveValue(correction.message);
      await expect(message).toBeEditable();
      await expect(back).toBeEnabled();
      await expect(close).toBeEnabled();
      await page.clock.install();
      await submit.click();
      await expectFeedbackConfirmation(correctionTitle, correctionSubtitle);
      assert.deepEqual(submissions, [correction, correction]);

      await page.clock.fastForward(4_000);
      await expect(success).toBeVisible();
      await page.clock.fastForward(1_000);
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      // Navigate inside the mounted app to catch product context leaking to other pages.
      await page.getByRole("link", { name: "Aviso de Privacidad", exact: true }).click();
      await page.waitForURL("**/privacidad");
      await page.setViewportSize({ width: 320, height: 568 });
      await trigger.click();
      await expect(dialog).toBeInViewport({ ratio: 1 });
      await selectOption(correctionTitle, correctionSubtitle, genericStarter);
      await dialog.getByRole("button", { name: "Volver", exact: true }).click();
      await selectOption("Sugerir una funcionalidad", "Comparte tus ideas para mejorar la plataforma.", "Me gustaría que Ludo Radar ");
      await message.fill("Me gustaría comparar varios juegos.");
      await submit.click();
      await expectFeedbackConfirmation("Sugerir una funcionalidad", "Comparte tus ideas para mejorar la plataforma.");
      await close.click();
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();

      await trigger.click();
      await page.clock.fastForward(5_000);
      await expect(dialog).toHaveAccessibleName("Ayúdanos a mejorar");
      await selectOption("Enviar un comentario", "Cuéntanos tu experiencia con Ludo Radar.", "Quiero compartir que ");
      await message.fill("Encontré el juego que buscaba.");
      await submit.click();
      await expectFeedbackConfirmation("Enviar un comentario", "Cuéntanos tu experiencia con Ludo Radar.");
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();

      await page.getByRole("button", { name: "Contacto", exact: true }).click();
      await expect(dialog).toHaveAccessibleName("Contacto");
      await dialog.getByRole("textbox", { name: "Nombre" }).fill("Nombre de prueba");
      await dialog.getByRole("textbox", { name: "Correo electrónico" }).fill("prueba@example.com");
      await message.fill("Mensaje del formulario de contacto.");
      await submit.click();
      await expect(dialog.getByText("Mensaje enviado.", { exact: true })).toBeVisible();
      await page.clock.fastForward(5_000);
      await expect(dialog).toHaveAccessibleName("Contacto");
      assert.deepEqual(submissions.slice(2), [
        { name: "Ludo Radar", email: "sugerencia@ludoradar.mx", message: "Me gustaría comparar varios juegos." },
        { name: "Ludo Radar", email: "comentario@ludoradar.mx", message: "Encontré el juego que buscaba." },
        { name: "Nombre de prueba", email: "prueba@example.com", message: "Mensaje del formulario de contacto." },
      ]);
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});

test("feedback closes on browser Back and leaves the footer attribution clear", { timeout: 60000 }, async t => {
  const server = await startFixtureServer();
  try {
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
      await page.route(url => url.pathname === "/api/contact", route => route.abort());
      const trigger = page.getByRole("button", { name: "Ayúdanos a mejorar" });

      await t.test("same-page history replacement preserves the open draft", async () => {
        await page.goto(`${origin}/search`);
        await trigger.click();
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("button", { name: /Enviar un comentario/ }).click();
        const message = dialog.getByRole("textbox", { name: "Mensaje" });
        await message.fill("Mi comentario sigue aquí.");
        await page.evaluate(() => {
          history.replaceState({ ...history.state, key: "new-search-key" }, "", "/search?q=dixit");
          window.dispatchEvent(new PopStateEvent("popstate"));
        });
        await expect(page).toHaveURL(`${origin}/search?q=dixit`);
        await expect(dialog).toHaveAccessibleName("Enviar un comentario");
        await expect(message).toHaveValue("Mi comentario sigue aquí.");
      });

      await t.test("a stalled feedback send times out and restores the draft and controls", async () => {
        await page.goto(`${origin}/privacidad`);
        await trigger.click();
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("button", { name: /Enviar un comentario/ }).click();
        const message = dialog.getByRole("textbox", { name: "Mensaje" });
        const submit = dialog.getByRole("button", { name: "Enviar", exact: true });
        await message.fill("Comentario que quiero conservar.");
        let releaseResponse;
        const responseGate = new Promise(resolve => { releaseResponse = resolve; });
        const isContact = url => url.pathname === "/api/contact";
        await page.route(isContact, async route => {
          await responseGate;
          await route.fulfill({ status: 201, json: { data: { id: 1 } } });
        }, { times: 1 });
        const failedRequests = [];
        const recordFailure = request => {
          if (isContact(new URL(request.url()))) failedRequests.push(request.failure()?.errorText);
        };
        page.on("requestfailed", recordFailure);
        try {
          await page.clock.install();
          await submit.click();
          const pending = dialog.getByRole("button", { name: "Enviando…" });
          await page.clock.fastForward(14_000);
          await expect(pending).toBeDisabled();
          await page.clock.fastForward(1_000);
          await expect(dialog.getByRole("alert")).toHaveText("No pudimos enviar el mensaje. Intenta de nuevo.");
          await expect.poll(() => failedRequests).toContain("net::ERR_ABORTED");
          await expect(message).toBeEditable();
          await expect(message).toHaveValue("Comentario que quiero conservar.");
          await expect(submit).toBeEnabled();
          await expect(dialog.getByRole("button", { name: "Volver", exact: true })).toBeEnabled();
          await expect(dialog.getByRole("button", { name: "Cerrar", exact: true })).toBeEnabled();
        } finally {
          page.off("requestfailed", recordFailure);
          releaseResponse();
        }
      });

      await t.test("browser Back closes a game correction before showing the previous page", async () => {
        await page.goto(`${origin}/privacidad`);
        await expect(page.getByRole("heading", { name: "Aviso de Privacidad", exact: true })).toBeVisible();
        await page.evaluate(() => {
          history.pushState({ idx: 1 }, "", "/game/851/dixit");
          window.dispatchEvent(new PopStateEvent("popstate"));
        });
        await expect(page.getByRole("heading", { name: "Dixit", exact: true })).toBeVisible();
        await trigger.click();
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("button", { name: new RegExp(correctionTitle) }).click();
        await expect(dialog.getByRole("textbox", { name: "Mensaje" })).toHaveJSProperty("value", gameStarter);

        await page.goBack();
        await expect(page).toHaveURL(`${origin}/privacidad`);
        await expect(dialog).toHaveCount(0);
        await trigger.click();
        await dialog.getByRole("button", { name: new RegExp(correctionTitle) }).click();
        await expect(dialog.getByRole("textbox", { name: "Mensaje" })).toHaveJSProperty("value", genericStarter);
      });

      for (const [width, height] of [[1280, 800], [320, 568]]) {
        await t.test(`the footer attribution clears the feedback button at ${width}px`, async () => {
          await page.setViewportSize({ width, height });
          await page.goto(`${origin}/privacidad`);
          const attribution = page.getByRole("link", { name: "Con tecnología de BoardGameGeek" });
          await attribution.scrollIntoViewIfNeeded();
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await expect(attribution).toBeInViewport({ ratio: 1 });
          await expect(trigger).toBeInViewport({ ratio: 1 });
          const attributionBounds = await attribution.boundingBox();
          const triggerBounds = await trigger.boundingBox();
          assert.ok(attributionBounds && triggerBounds);
          assert.ok(attributionBounds.y + attributionBounds.height <= triggerBounds.y - 8,
            `expected clearance, attribution ends at ${attributionBounds.y + attributionBounds.height}px and button starts at ${triggerBounds.y}px`);
          await attribution.click({ trial: true });
        });
      }
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
});
