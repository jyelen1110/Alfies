const sharp = require('sharp');
const path = require('path');

// Create a simple generic icon for Easy Ordering
// A gradient background with "EO" text would be ideal but sharp doesn't support text
// So we'll create a simple colored icon with a shopping cart shape

const size = 1024;
const iconColor = '#E67E22'; // Accent orange from theme
const bgColor = '#2C3E50'; // Primary dark from theme

// Create a simple SVG with a cart icon
const svg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${bgColor}"/>
  <g transform="translate(${size * 0.15}, ${size * 0.15}) scale(${size * 0.007})">
    <path fill="${iconColor}" d="M17 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-3l1.1-2h7.45c.75 0 1.41-.41 1.75-1.03L21.7 4H5.21l-.94-2H1v2h2l3.6 7.59L3.62 17H19v-2H7zM6.16 6h12.15l-2.76 5H8.53L6.16 6z"/>
  </g>
  <text x="50%" y="70%" font-family="Arial, sans-serif" font-size="${size * 0.25}" font-weight="bold" fill="${iconColor}" text-anchor="middle">EO</text>
</svg>
`;

async function generateIcons() {
  const assetsDir = path.join(__dirname, '..', 'assets');

  // Generate main icon (1024x1024)
  await sharp(Buffer.from(svg))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));

  console.log('Generated icon.png (1024x1024)');

  // Generate adaptive icon for Android (same as main)
  await sharp(Buffer.from(svg))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'adaptive-icon.png'));

  console.log('Generated adaptive-icon.png (1024x1024)');

  // Generate favicon (smaller)
  await sharp(Buffer.from(svg))
    .resize(196, 196)
    .png()
    .toFile(path.join(assetsDir, 'favicon.png'));

  console.log('Generated favicon.png (196x196)');

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
