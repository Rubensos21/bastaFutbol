import { test, expect, type Page } from '@playwright/test';
test('tres contextos: sala real, rondas completas, privacidad, puntos y revancha', async ({
  browser,
}, info) => {
  const contexts = await Promise.all(
    Array.from({ length: 3 }, () =>
      browser.newContext({ viewport: info.project.use.viewport, reducedMotion: 'reduce' }),
    ),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const host = pages[0]!;
  try {
    await host.goto('/');
    await expect(host.getByText('EN LÍNEA', { exact: true })).toBeVisible();
    await host.getByLabel('TU NOMBRE EN LA CANCHA').fill('Davo');
    await host.getByLabel('Rondas', { exact: true }).selectOption('3');
    await host.getByText('Personalizar letras y categorías', { exact: true }).click();
    await host.getByLabel('Letras jugables').fill('M');
    await host.getByLabel('Letras jugables').blur();
    const controls = host.locator('.category-options label');
    const allowedLabels = [
      'Jugador',
      'Entrenador',
      'Club',
      'País que jugó un Mundial',
      'Leyenda del fútbol',
      'Mejor entrenador de la historia',
      'Mejor prime de un jugador',
    ];
    for (const label of await controls.all()) {
      const text = (await label.innerText()).replace('Desactivar ', '').trim();
      if (!allowedLabels.includes(text)) await label.locator('input').check();
    }
    await host.getByRole('button', { name: 'Crear sala privada' }).click();
    await expect(host.locator('.room-code')).toBeVisible();
    const invite = host.url();
    for (const [index, page] of pages.entries())
      if (index) {
        await page.goto(invite);
        await page.getByLabel('TU APODO').fill(['Davo', 'Cobra', 'Teo'][index]!);
        await page.getByRole('button', { name: 'Unirme a la sala' }).click();
      }
    for (const page of pages) await expect(page.locator('.count-badge')).toHaveText('3/7');
    await host.screenshot({ path: `test-results/lobby-${info.project.name}.png`, fullPage: true });
    for (const page of pages) await page.getByRole('button', { name: 'Estoy listo' }).click();
    await host.getByRole('button', { name: 'Comenzar partida' }).click();
    for (let round = 1; round <= 3; round++) {
      for (const page of pages)
        await expect(page.getByRole('heading', { name: 'RULETA DE LETRAS' })).toBeVisible();
      let picker: Page | undefined;
      for (const page of pages)
        if (await page.getByRole('button', { name: 'PARAR', exact: true }).isEnabled())
          picker = page;
      expect(picker).toBeDefined();
      await picker!.getByRole('button', { name: 'PARAR', exact: true }).click();
      for (const page of pages)
        await expect(page.getByRole('heading', { name: 'LA LETRA ES:' })).toBeVisible();
      for (const [index, page] of pages.entries()) {
        await expect(page.getByRole('heading', { name: 'Que hable tu fútbol.' })).toBeVisible({
          timeout: 10000,
        });
        await page.getByRole('button', { name: 'Mi tablero', exact: true }).click();
        const field = page
          .locator('.answer-field')
          .filter({ has: page.locator('strong', { hasText: /^Jugador$/ }) })
          .locator('input');
        await field.fill(index === 2 ? 'Mbappé' : 'Messi');
        await expect(page.getByText('Guardado', { exact: true })).toBeVisible();
      }
      // Inspección de las respuestas renderizadas antes del bloqueo: cada contexto ve solo lo propio.
      expect(await host.locator('.board-section').innerText()).not.toContain('Mbappé');
      if (round === 1) {
        await pages[1]!.reload();
        await expect(
          pages[1]!.getByRole('heading', { name: 'Que hable tu fútbol.' }),
        ).toBeVisible();
        await pages[1]!.getByRole('button', { name: 'Mi tablero', exact: true }).click();
        await expect(
          pages[1]!
            .locator('.answer-field')
            .filter({ has: pages[1]!.locator('strong', { hasText: /^Jugador$/ }) })
            .locator('input'),
        ).toHaveValue('Messi');
      }
      await host.screenshot({
        path: `test-results/tablero-${info.project.name}.png`,
        fullPage: true,
      });
      await host.getByRole('button', { name: '¡BASTA!' }).click();
      for (const page of pages)
        await expect(page.getByRole('heading', { name: 'Validez antes que puntos.' })).toBeVisible({
          timeout: 15000,
        });
      for (const page of pages) {
        await page.locator('.category-select select').selectOption('player');
        for (const button of await page
          .getByRole('button', { name: '✓ Válida', exact: true })
          .all())
          await button.click();
      }
      await host.getByRole('button', { name: 'Publicar puntos' }).click();
      for (const page of pages) await expect(page.locator('.leaderboard')).toBeVisible();
      const teo = host.locator('.leaderboard-row').filter({ hasText: 'Teo' });
      await expect(teo.locator('.total')).toHaveText(`${20 * round}PTS`);
      await expect(
        host.locator('.leaderboard-row').filter({ hasText: 'Davo' }).locator('.total'),
      ).toHaveText(`${10 * round}PTS`);
      if (round < 3) await host.getByRole('button', { name: 'Siguiente ronda' }).click();
    }
    for (const page of pages)
      await expect(page.getByRole('heading', { name: 'Tenemos campeón.' })).toBeVisible();
    await host.getByRole('button', { name: 'Revancha con el mismo grupo' }).click();
    for (const page of pages) await expect(page.locator('.room-code')).toBeVisible();
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
