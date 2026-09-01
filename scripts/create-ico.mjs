import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconsDir = path.join(__dirname, '..', 'src-tauri', 'icons');

console.log('🪟 Creating Windows .ico file...\n');

async function createIco() {
  try {
    const sizes = [32, 128, 256];
    const pngFiles = sizes.map(size => 
      path.join(iconsDir, size === 256 ? '128x128@2x.png' : `${size}x${size}.png`)
    );

    // Check if all PNG files exist
    for (const file of pngFiles) {
      if (!fs.existsSync(file)) {
        console.error(`❌ PNG file not found: ${file}`);
        process.exit(1);
      }
    }

    console.log('✅ All PNG files found');
    console.log('🔄 Converting to .ico format...');

    const buf = await pngToIco(pngFiles);
    const outputPath = path.join(iconsDir, 'icon.ico');
    fs.writeFileSync(outputPath, buf);

    console.log(`✅ Created icon.ico`);
    console.log('');
    console.log('✨ Windows icon complete!');
    console.log('');
    console.log('📝 For macOS (.icns):');
    console.log('  1. Go to https://cloudconvert.com/png-to-icns');
    console.log(`  2. Upload: ${path.join(iconsDir, 'icon.png')}`);
    console.log('  3. Download and save as icon.icns');
    console.log('');
    console.log('🚀 Or just rebuild now: npm run tauri dev');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createIco();
