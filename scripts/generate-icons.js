const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputImagePath = 'C:\\Users\\jibin\\.gemini\\antigravity\\brain\\04ff799f-5389-4e8b-aa33-409868b0cb94\\codetrack_icon_1772014692765.png';
const outputDir = 'd:\\GitHub\\Duo\\public\\icons';

async function generateIcons() {
    try {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Generate 192x192
        await sharp(inputImagePath)
            .resize(192, 192)
            .toFile(path.join(outputDir, 'icon-192x192.png'));

        console.log('Successfully created icon-192x192.png');

        // Generate 512x512
        await sharp(inputImagePath)
            .resize(512, 512)
            .toFile(path.join(outputDir, 'icon-512x512.png'));

        console.log('Successfully created icon-512x512.png');

        // Generate Apple Touch Icon
        await sharp(inputImagePath)
            .resize(180, 180)
            .toFile(path.join(outputDir, 'apple-touch-icon.png'));

        console.log('Successfully created apple-touch-icon.png');

    } catch (error) {
        console.error('Error generating icons:', error);
    }
}

generateIcons();
