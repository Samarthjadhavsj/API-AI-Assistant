import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceImage = 'C:\\Users\\SAMAR\\OneDrive\\Desktop\\Pluly\\heyFrank2.jpg';
const iconsDir = path.join(__dirname, '..', 'src-tauri', 'icons');
const publicDir = path.join(__dirname, '..', 'public');

console.log('🎨 Converting heyFrank2 icon to all required formats...\n');

async function convertIcon() {
  try {
    // Check if source exists
    if (!fs.existsSync(sourceImage)) {
      console.error('❌ Source image not found:', sourceImage);
      process.exit(1);
    }

    console.log('✅ Source image found:', sourceImage);
    console.log('📂 Output directory:', iconsDir);
    console.log('');

    // Read the source image
    const image = sharp(sourceImage);
    const metadata = await image.metadata();
    console.log(`📐 Source dimensions: ${metadata.width}x${metadata.height}`);
    console.log('');

    // Convert to different PNG sizes
    const sizes = [
      { width: 32, height: 32, name: '32x32.png' },
      { width: 128, height: 128, name: '128x128.png' },
      { width: 256, height: 256, name: '128x128@2x.png' },
      { width: 512, height: 512, name: 'icon.png' }
    ];

    console.log('🔄 Converting to PNG sizes...');
    const pngPaths = [];
    
    for (const size of sizes) {
      const outputPath = path.join(iconsDir, size.name);
      await sharp(sourceImage)
        .resize(size.width, size.height, {
          fit: 'cover', // Use 'cover' to fill the space without borders
          position: 'center'
        })
        .png()
        .toFile(outputPath);
      console.log(`  ✅ Created ${size.name} (${size.width}x${size.height})`);
      
      // Store paths for .ico creation
      if (size.width <= 256) {
        pngPaths.push(outputPath);
      }
    }

    // Also copy to public folder for web access
    const publicIconPath = path.join(publicDir, 'icon.png');
    await sharp(sourceImage)
      .resize(512, 512, {
        fit: 'cover', // Use 'cover' to fill the space without borders
        position: 'center'
      })
      .png()
      .toFile(publicIconPath);
    console.log(`  ✅ Copied to public/icon.png`);

    console.log('');
    console.log('🪟 Creating Windows .ico file...');
    
    // Create .ico file
    const buf = await pngToIco(pngPaths);
    const icoPath = path.join(iconsDir, 'icon.ico');
    fs.writeFileSync(icoPath, buf);
    console.log('  ✅ Created icon.ico');

    console.log('');
    console.log('✨ Icon conversion complete!');
    console.log('');
    console.log('📝 Generated files:');
    console.log('  • 32x32.png');
    console.log('  • 128x128.png');
    console.log('  • 128x128@2x.png (256x256)');
    console.log('  • icon.png (512x512)');
    console.log('  • icon.ico (Windows)');
    console.log('  • public/icon.png (web)');
    console.log('');
    console.log('🚀 Ready to test: npm run tauri dev');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

convertIcon();
