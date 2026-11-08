// Generates the app icons from one SVG, in the app's colours (blue = Jibin,
// rose = Achsah, coral accent).
//   node scripts/generate-icons.js          -> "sprout" (current icon)
//   node scripts/generate-icons.js rings    -> interlocking rings
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const R = 114; // ring radius
const SW = 36; // ring thickness
const CY = 256;
const LX = 202;
const RX = 310;
// Bottom crossing point of the two rings (where the blue one weaves back over)
const ix = (LX + RX) / 2;
const iy = CY + Math.sqrt(R * R - ((RX - LX) / 2) ** 2);

// The rings stay well inside the central 80% "safe zone", so Android can mask
// the icon to any shape (circle, squircle) without clipping them.
const ringsSvg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#211719"/><stop offset="1" stop-color="#0b0809"/></linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffe0bf"/><stop offset=".6" stop-color="#f4a07c"/><stop offset="1" stop-color="#e8735a"/></radialGradient>
  <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#e8735a" stop-opacity=".28"/><stop offset="1" stop-color="#e8735a" stop-opacity="0"/></radialGradient>
  <linearGradient id="blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86a8de"/><stop offset="1" stop-color="#5b7db1"/></linearGradient>
  <linearGradient id="rose" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e199a3"/><stop offset="1" stop-color="#b86b77"/></linearGradient>
  <clipPath id="inL"><circle cx="${LX}" cy="${CY}" r="${R}"/></clipPath>
  <clipPath id="cross"><rect x="${ix - 44}" y="${iy - 44}" width="88" height="88"/></clipPath>
  <mask id="onRose" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><circle cx="${RX}" cy="${CY}" r="${R}" fill="none" stroke="#fff" stroke-width="${SW}"/></mask>
</defs>
<rect width="512" height="512" fill="url(#bg)"/>
<circle cx="256" cy="256" r="230" fill="url(#halo)"/>
<circle cx="${RX}" cy="${CY}" r="${R}" fill="url(#glow)" clip-path="url(#inL)"/>
<circle cx="${LX}" cy="${CY}" r="${R}" fill="none" stroke="url(#blue)" stroke-width="${SW}"/>
<circle cx="${RX}" cy="${CY}" r="${R}" fill="none" stroke="url(#rose)" stroke-width="${SW}"/>
<g clip-path="url(#cross)">
  <circle cx="${LX}" cy="${CY}" r="${R}" fill="none" stroke="#0b0809" stroke-opacity=".6" stroke-width="${SW + 12}" mask="url(#onRose)"/>
  <circle cx="${LX}" cy="${CY}" r="${R}" fill="none" stroke="url(#blue)" stroke-width="${SW}"/>
</g>
</svg>`;

// Sprout: two leaves from one stem, together forming a heart ("grow together")
const leafL = 'M253 304 C 196 278, 118 240, 116 176 C 114 124, 170 102, 210 132 C 242 156, 256 214, 253 304 Z';
const mirror = (p) => p.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${512 - Number(x)} ${y}`);
const vein = 'M250 292 C 236 240, 204 192, 156 160';
const sproutSvg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26191b"/><stop offset="1" stop-color="#0b0809"/></linearGradient>
  <radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffcf9e" stop-opacity=".75"/><stop offset=".45" stop-color="#e8735a" stop-opacity=".28"/><stop offset="1" stop-color="#e8735a" stop-opacity="0"/></radialGradient>
  <linearGradient id="lb" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#4f71a6"/><stop offset="1" stop-color="#a4c0ec"/></linearGradient>
  <linearGradient id="lr" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ad5f6c"/><stop offset="1" stop-color="#f0b0b8"/></linearGradient>
  <linearGradient id="stem" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd8ae"/><stop offset="1" stop-color="#e8735a"/></linearGradient>
</defs>
<rect width="512" height="512" fill="url(#bg)"/>
<circle cx="256" cy="226" r="210" fill="url(#sun)"/>
<path d="M256 404 C 256 376, 252 340, 253 292" stroke="url(#stem)" stroke-width="20" stroke-linecap="butt" fill="none"/>
<circle cx="256" cy="404" r="10" fill="#e8735a"/>
<path d="${leafL}" fill="url(#lb)"/>
<path d="${mirror(leafL)}" fill="url(#lr)"/>
<path d="${vein}" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none"/>
<path d="${mirror(vein)}" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none"/>
<ellipse cx="256" cy="408" rx="46" ry="7" fill="#e8735a" opacity=".35"/>
</svg>`;

const DESIGNS = { sprout: sproutSvg, rings: ringsSvg };
const design = process.argv[2] || 'sprout';
const svg = DESIGNS[design];
if (!svg) {
    console.error(`Unknown design "${design}". Use one of: ${Object.keys(DESIGNS).join(', ')}`);
    process.exit(1);
}

const root = path.join(__dirname, '..');
const iconsDir = path.join(root, 'public', 'icons');

// Render large once, then downscale (crisper than rendering small)
const master = () => sharp(Buffer.from(svg(1024)));
const png = (size) => master().resize(size, size).png({ compressionLevel: 9 });

/** .ico holding PNG images (supported by every current browser) */
function ico(images) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(images.length, 4);
    let offset = 6 + 16 * images.length;
    const entries = images.map(({ size, data }) => {
        const e = Buffer.alloc(16);
        e.writeUInt8(size >= 256 ? 0 : size, 0);
        e.writeUInt8(size >= 256 ? 0 : size, 1);
        e.writeUInt16LE(1, 4); // colour planes
        e.writeUInt16LE(32, 6); // bits per pixel
        e.writeUInt32LE(data.length, 8);
        e.writeUInt32LE(offset, 12);
        offset += data.length;
        return e;
    });
    return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

async function main() {
    fs.mkdirSync(iconsDir, { recursive: true });
    await png(512).toFile(path.join(iconsDir, 'icon-512x512.png'));
    await png(192).toFile(path.join(iconsDir, 'icon-192x192.png'));
    // iOS rounds the corners itself; the icon must be opaque and full-bleed
    await png(180).toFile(path.join(iconsDir, 'apple-touch-icon.png'));
    const sizes = [16, 32, 48];
    const images = await Promise.all(sizes.map(async (size) => ({ size, data: await png(size).toBuffer() })));
    fs.writeFileSync(path.join(root, 'app', 'favicon.ico'), ico(images));
    console.log(`Icons (${design}) written to public/icons and app/favicon.ico`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
