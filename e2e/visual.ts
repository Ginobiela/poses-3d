import { expect, type Page } from '@playwright/test';

export async function compareRenderedPose(page: Page, before: Buffer, after: Buffer) {
  const difference = await page.evaluate(async ({ a, b }) => {
    const pixels = async (encoded: string) => {
      const image = new Image(); image.src = `data:image/png;base64,${encoded}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, image.width, image.height).data;
    };
    const [first, second] = await Promise.all([pixels(a), pixels(b)]);
    if (first.length !== second.length) return 1;
    let changed = 0;
    for (let i = 0; i < first.length; i += 4) if ([0, 1, 2].some(channel => Math.abs(first[i + channel]! - second[i + channel]!) > 2)) changed++;
    return changed / (first.length / 4);
  }, { a: before.toString('base64'), b: after.toString('base64') });
  // Allow GPU channel rounding; the tests also compare every exported joint numerically.
  expect(difference).toBeLessThan(.0001);
}
