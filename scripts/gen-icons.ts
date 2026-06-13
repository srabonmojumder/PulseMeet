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
  // pulse path points (relative to tile), then offset by inset
  const pts = [
    [0.18, 0.52],
    [0.38, 0.52],
    [0.46, 0.72],
    [0.58, 0.28],
    [0.66, 0.52],
    [0.82, 0.52],
  ];
  const d = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${inset + x * tile} ${inset + y * tile}`)
    .join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset="1" stop-color="#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>
  <path d="${d}" fill="none" stroke="#ffffff" stroke-width="${Math.round(tile * 0.07)}"
    stroke-linecap="round" stroke-linejoin="round"/>
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
