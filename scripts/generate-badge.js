// Generates the monochrome notification badge (Android status-bar icon).
// Android only uses the alpha channel of the badge, so a full-colour icon
// shows up as a solid white square. Run: node scripts/generate-badge.js
const sharp = require('sharp');
const path = require('path');

// Two overlapping rings — "Duo" — in white on transparent
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <g fill="none" stroke="#fff" stroke-width="9">
    <circle cx="36" cy="48" r="22"/>
    <circle cx="60" cy="48" r="22"/>
  </g>
</svg>`;

sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(__dirname, '..', 'public', 'icons', 'badge-96.png'))
    .then(() => console.log('Created public/icons/badge-96.png'))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
