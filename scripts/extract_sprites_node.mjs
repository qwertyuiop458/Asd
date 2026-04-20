import { createReadStream, createWriteStream, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { createUnzip } from 'zlib';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { Extract } from 'unzipper';

const JAR_PATH = '/vercel/share/v0-project/240x320-rus-zombie-infection.jar';
const OUTPUT_DIR = '/vercel/share/v0-project/extracted_sprites';

// Image signatures
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const GIF87_SIG = Buffer.from('GIF87a');
const GIF89_SIG = Buffer.from('GIF89a');
const JPEG_SIG = Buffer.from([0xFF, 0xD8, 0xFF]);

function ensureDir(dir) {
  try {
    mkdirSync(dir, { recursive: true });
  } catch (e) {}
}

function findPNGsInBuffer(buffer) {
  const results = [];
  let pos = 0;
  
  while (pos < buffer.length - 8) {
    const idx = buffer.indexOf(PNG_SIG, pos);
    if (idx === -1) break;
    
    // Find IEND chunk
    const iendIdx = buffer.indexOf('IEND', idx);
    if (iendIdx !== -1) {
      const endPos = iendIdx + 12; // IEND chunk + CRC
      results.push({
        offset: idx,
        data: buffer.slice(idx, Math.min(endPos, buffer.length))
      });
    }
    pos = idx + 1;
  }
  
  return results;
}

function findGIFsInBuffer(buffer) {
  const results = [];
  
  for (const sig of [GIF87_SIG, GIF89_SIG]) {
    let pos = 0;
    while (pos < buffer.length - 6) {
      const idx = buffer.indexOf(sig, pos);
      if (idx === -1) break;
      
      // Find GIF trailer 0x3B
      let endPos = idx + 6;
      while (endPos < buffer.length && buffer[endPos] !== 0x3B) {
        endPos++;
      }
      if (endPos < buffer.length) {
        results.push({
          offset: idx,
          data: buffer.slice(idx, endPos + 1)
        });
      }
      pos = idx + 1;
    }
  }
  
  return results;
}

async function main() {
  console.log('='.repeat(60));
  console.log('ZOMBIE INFECTION SPRITE EXTRACTOR');
  console.log('='.repeat(60));
  
  ensureDir(OUTPUT_DIR);
  ensureDir(join(OUTPUT_DIR, 'direct_images'));
  ensureDir(join(OUTPUT_DIR, 'embedded_images'));
  ensureDir(join(OUTPUT_DIR, 'raw_data'));
  
  // Read entire JAR as buffer
  const jarBuffer = readFileSync(JAR_PATH);
  console.log(`\nJAR file size: ${jarBuffer.length} bytes`);
  
  // Extract JAR contents
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(JAR_PATH);
  const entries = zip.getEntries();
  
  let directImages = 0;
  let embeddedImages = 0;
  
  console.log(`\nTotal entries in JAR: ${entries.length}`);
  console.log('\n--- FILES IN JAR ---');
  
  for (const entry of entries) {
    const name = entry.entryName;
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const data = entry.getData();
    
    console.log(`  ${name} (${data.length} bytes)`);
    
    // Direct images
    if (['png', 'gif', 'jpg', 'jpeg', 'bmp'].includes(ext)) {
      const safeName = name.replace(/[\/\\]/g, '_');
      writeFileSync(join(OUTPUT_DIR, 'direct_images', safeName), data);
      console.log(`    -> DIRECT IMAGE extracted`);
      directImages++;
    }
    
    // Check for embedded images in all files
    const pngs = findPNGsInBuffer(data);
    const gifs = findGIFsInBuffer(data);
    
    for (let i = 0; i < pngs.length; i++) {
      const safeName = name.replace(/[\/\\]/g, '_').replace(/\.[^.]+$/, '');
      const outPath = join(OUTPUT_DIR, 'embedded_images', `${safeName}_png_${i}_offset_${pngs[i].offset}.png`);
      writeFileSync(outPath, pngs[i].data);
      console.log(`    -> EMBEDDED PNG at offset ${pngs[i].offset}`);
      embeddedImages++;
    }
    
    for (let i = 0; i < gifs.length; i++) {
      const safeName = name.replace(/[\/\\]/g, '_').replace(/\.[^.]+$/, '');
      const outPath = join(OUTPUT_DIR, 'embedded_images', `${safeName}_gif_${i}_offset_${gifs[i].offset}.gif`);
      writeFileSync(outPath, gifs[i].data);
      console.log(`    -> EMBEDDED GIF at offset ${gifs[i].offset}`);
      embeddedImages++;
    }
    
    // Save potentially interesting raw data
    if (!['class', 'mf', 'sf', 'rsa'].includes(ext) && data.length > 50) {
      const safeName = name.replace(/[\/\\]/g, '_');
      writeFileSync(join(OUTPUT_DIR, 'raw_data', safeName), data);
    }
  }
  
  // Deep scan entire JAR binary
  console.log('\n--- DEEP SCAN OF JAR BINARY ---');
  
  const jarPngs = findPNGsInBuffer(jarBuffer);
  const jarGifs = findGIFsInBuffer(jarBuffer);
  
  console.log(`Found ${jarPngs.length} PNG signatures in JAR`);
  console.log(`Found ${jarGifs.length} GIF signatures in JAR`);
  
  for (let i = 0; i < jarPngs.length; i++) {
    const outPath = join(OUTPUT_DIR, 'embedded_images', `jar_deep_png_${i}_offset_${jarPngs[i].offset}.png`);
    writeFileSync(outPath, jarPngs[i].data);
  }
  
  for (let i = 0; i < jarGifs.length; i++) {
    const outPath = join(OUTPUT_DIR, 'embedded_images', `jar_deep_gif_${i}_offset_${jarGifs[i].offset}.gif`);
    writeFileSync(outPath, jarGifs[i].data);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('EXTRACTION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Direct images: ${directImages}`);
  console.log(`Embedded images found: ${embeddedImages + jarPngs.length + jarGifs.length}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  
  // List extracted files
  console.log('\n--- EXTRACTED FILES ---');
  const listDir = (dir, prefix = '') => {
    try {
      const files = readdirSync(dir);
      for (const f of files) {
        const fullPath = join(dir, f);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          console.log(`${prefix}${f}/`);
          listDir(fullPath, prefix + '  ');
        } else {
          console.log(`${prefix}${f} (${stat.size} bytes)`);
        }
      }
    } catch (e) {}
  };
  listDir(OUTPUT_DIR);
}

main().catch(console.error);
