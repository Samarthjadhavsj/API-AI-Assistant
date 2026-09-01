import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceImage = path.join(__dirname, '..', 'src-tauri', 'icons', 'icon-source.png');
const iconsDir = path.join(__dirname, '..', 'src-tauri', 'icons');

console.log('🎨 Converting icon to all required formats...\n');

async function convertIcon() {
  try {
    // Check if source exists
    if (!fs.existsSync(sourceImage)) {
      console.error('❌ Source image not found:', sourceImage);
      process.exit(1);
    }

    console.log('✅ Source image found');
    console.log('📂 Output directory:', iconsDir);
    console.log('');

    // Read the source image
    const image = sharp(sourceImage);
    const metadata = await image.metadata();
    console.log(`📐 Source dimensions: ${metadata.width}x${metadata.height}`);
    console.log('');

    // Convert to different sizes
    const sizes = [
      { width: 32, height: 32, name: '32x32.png' },
      { width: 128, height: 128, name: '128x128.png' },
      { width: 256, height: 256, name: '128x128@2x.png' },
      { width: 512, height: 512, name: 'icon.png' }
    ];

    console.log('🔄 Converting to PNG sizes...');
    for (const size of sizes) {
      const outputPath = path.join(iconsDir, size.name);
      await sharp(sourceImage)
        .resize(size.width, size.height, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      console.log(`  ✅ Created ${size.name} (${size.width}x${size.height})`);
    }

    console.log('');
    console.log('✨ Icon conversion complete!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('  1. For Windows (.ico): Use https://redketchup.io/icon-converter');
    console.log('  2. For macOS (.icns): Use https://cloudconvert.com/png-to-icns');
    console.log('  3. Or rebuild the app and test: npm run tauri build');
    console.log('');
    console.log('💡 Tip: The PNG files are ready to use!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

convertIcon();
