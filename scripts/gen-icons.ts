/**
 * Generates PWA icons from an inline SVG into public/icons/.
 *   pnpm exec tsx scripts/gen-icons.ts
 * Matches the favicon (src/app/icon.svg): indigo→violet tile + white pulse line.
 */
import sharp from "sharp";
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "icons");

// `pad` leaves a safe zone (for maskable). Pulse line is drawn on a 0..1 grid
// scaled to the tile so it stays centered at any size.
function svg(size: number, pad: number) {
  const r = Math.round(size * 0.22);
  const inset = Math.round(size * pad);
  const tile = size - inset * 2;
  const fontSize = Math.round(tile * 0.6);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset="1" stop-color="#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>
  <text x="50%" y="50%" dy="0.345em" text-anchor="middle"
    font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${fontSize}"
    fill="#ffffff">P</text>
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
  // Keep the in-app apple-icon in sync.
  await copyFile(
    path.join(OUT, "apple-touch-icon.png"),
    path.join(process.cwd(), "src", "app", "apple-icon.png"),
  );
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
