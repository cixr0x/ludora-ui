import assert from "node:assert/strict";
import test from "node:test";
import { chromium, expect } from "@playwright/test";
import { startFixtureServer } from "./fixture-server.mjs";

test("site-wide feedback sends the selected category and keeps a failed correction editable", { timeout: 60000 }, async () => {
  const server = await startFixtureServer();
  try {
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
      const submissions = [];
      await page.route(url => url.pathname === "/api/contact", async route => {
        const request = route.request();
        assert.equal(request.method(), "POST");
        submissions.push(request.postDataJSON());
        if (submissions.length === 1) {
          await route.fulfill({ status: 503, json: { error: "Unavailable" } });
        } else {
          await route.fulfill({ status: 201, json: { data: { id: submissions.length } } });
        }
      });
      await page.goto("http://127.0.0.1:5175/game/851/dixit");
      const trigger = page.getByRole("button", { name: "Ayúdanos a mejorar" });
      const dialog = page.getByRole("dialog");
      const message = dialog.getByRole("textbox", { name: "Mensaje" });
      const submit = dialog.getByRole("button", { name: "Enviar", exact: true });
      const success = dialog.getByText("Mensaje enviado.", { exact: true });

      async function selectOption(title, subtitle, starter) {
        await expect(dialog).toHaveAccessibleName("Ayúdanos a mejorar");
        const choice = dialog.getByRole("button", { name: new RegExp(title) });
        await expect(choice.getByText(subtitle, { exact: true })).toBeVisible();
        await choice.press("Enter");
        await expect(dialog).toHaveAccessibleName(title);
        await expect(dialog).toHaveAccessibleDescription(subtitle);
        await expect(message).toBeFocused();
        await expect(message).toHaveJSProperty("value", starter);
      }

      await expect(trigger).toBeVisible();
      await expect(page.getByRole("heading", { name: "Dixit", exact: true })).toBeVisible();
      await trigger.press("Enter");
      const correctionTitle = "Reportar información incorrecta";
      const correctionSubtitle = "Datos de juegos, precios, tiendas o enlaces.";
      const gameStarter = "Encontré el siguiente error sobre el juego «Dixit» (ID 851): ";
      await selectOption(correctionTitle, correctionSubtitle, gameStarter);
      await message.press("End");
      await message.pressSequentially("El enlace no funciona.");
      const correction = { name: "Ludo Radar", email: "correccion@ludoradar.mx", message: `${gameStarter}El enlace no funciona.` };
      await submit.click();
      await expect(dialog.getByRole("alert")).toHaveText("No pudimos enviar el mensaje. Intenta de nuevo.");
      await expect(success).toHaveCount(0);
      await expect(message).toHaveValue(correction.message);
      await submit.click();
      await expect(success).toBeVisible();
      assert.deepEqual(submissions, [correction, correction]);

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      // Navigate inside the mounted app to catch product context leaking to other pages.
      await page.getByRole("link", { name: "Aviso de Privacidad", exact: true }).click();
      await page.waitForURL("**/privacidad");
      await page.setViewportSize({ width: 320, height: 568 });
      await trigger.click();
      await expect(dialog).toBeInViewport({ ratio: 1 });
      await selectOption(correctionTitle, correctionSubtitle, "La información que encontré incorrecta es…");
      await dialog.getByRole("button", { name: "Volver", exact: true }).click();
      await selectOption("Sugerir una funcionalidad", "Comparte tus ideas para mejorar la plataforma.", "Me gustaría que Ludo Radar pudiera…");
      await message.fill("Me gustaría comparar varios juegos.");
      await submit.click();
      await expect(success).toBeVisible();
      await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();

      await trigger.click();
      await selectOption("Enviar un comentario", "Cuéntanos tu experiencia con Ludo Radar.", "Quiero compartir que…");
      await message.fill("Encontré el juego que buscaba.");
      await submit.click();
      await expect(success).toBeVisible();
      await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();

      await page.getByRole("button", { name: "Contacto", exact: true }).click();
      await expect(dialog).toHaveAccessibleName("Contacto");
      await dialog.getByRole("textbox", { name: "Nombre" }).fill("Nombre de prueba");
      await dialog.getByRole("textbox", { name: "Correo electrónico" }).fill("prueba@example.com");
      await message.fill("Mensaje del formulario de contacto.");
      await submit.click();
      await expect(success).toBeVisible();
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
