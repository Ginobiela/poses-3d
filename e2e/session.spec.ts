import { expect, test } from '@playwright/test';

test('permite pausar, omitir, ver el resumen y repetir la sesión', async ({ page }) => {
  await page.goto('/poses-3d/');
  await page.getByLabel('Otra duración').fill('5');
  await page.getByRole('button', { name: '5 poses' }).click();
  await page.getByRole('button', { name: /Empezar a dibujar/ }).click();
  await expect(page.getByRole('heading', { name: 'La sesión empieza en' })).toBeVisible();
  await expect(page.getByText('EN CURSO')).toBeVisible({ timeout: 7_000 });
  await page.getByRole('button', { name: 'Cambiar tema' }).click();
  await page.getByRole('button', { name: /Pausar/ }).click();
  await expect(page.getByRole('heading', { name: 'Sesión en pausa' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  for (let i = 0; i < 5; i++) {
    if (await page.getByRole('button', { name: /Siguiente pose/ }).isVisible()) {
      await page.getByRole('button', { name: /Siguiente pose/ }).click();
    }
  }
  await expect(page.getByRole('heading', { name: 'Sesión completa' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver resumen' }).click();
  await expect(page.getByText('POSES OMITIDAS')).toBeVisible();
  await page.getByRole('button', { name: /Otra sesión/ }).click();
  await expect(page.getByText('POSE 1 DE 5')).toBeVisible();
});
