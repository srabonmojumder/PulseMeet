/**
 * Generates PWA icons from an inline SVG into public/icons/.
 *   pnpm exec tsx scripts/gen-icons.ts
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "icons");

// Indigo gradient tile with a white "P". `pad` leaves a safe zone for maskable.
function svg(size: number, pad: number) {
  const r = Math.round(size * 0.22);
  const inset = Math.round(size * pad);
  const tile = size - inset * 2;
  const fontSize = Math.round(tile * 0.62);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset="1" stop-color="#4338ca"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="#0f172a"/>
  <rect x="${inset}" y="${inset}" width="${tile}" height="${tile}" rx="${r}" fill="url(#g)"/>
  <text x="50%" y="50%" dy="0.34em" text-anchor="middle"
    font-family="Helvetica, Arial, sans-serif" font-weight="700"
    font-size="${fontSize}" fill="#ffffff">P</text>
</svg>`;
}

async function render(name: string, size: number, pad: number) {
  await sharp(Buffer.from(svg(size, pad))).png().toFile(path.join(OUT, name));
  console.log(`✓ ${name} (${size}x${size})`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await render("icon-192.png", 192, 0);
  await render("icon-512.png", 512, 0);
  await render("maskable-512.png", 512, 0.12);
  await render("apple-touch-icon.png", 180, 0);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
