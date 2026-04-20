import { createReadStream } from 'fs';
import { mkdir, writeFile, readdir } from 'fs/promises';
import { join, extname } from 'path';
import { createUnzip } from 'zlib';
import { Parse } from 'unzipper';

const JAR_PATH = './240x320-rus-zombie-infection.jar';
const OUTPUT_DIR = './extracted_resources';

async function extractJarContents() {
  console.log('=== J2ME JAR Resource Extractor ===\n');
  
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(join(OUTPUT_DIR, 'images'), { recursive: true });
  await mkdir(join(OUTPUT_DIR, 'data'), { recursive: true });
  await mkdir(join(OUTPUT_DIR, 'classes'), { recursive: true });
  
  const resources = {
    images: [],
    data: [],
    classes: [],
    other: []
  };
  
  return new Promise((resolve, reject) => {
    createReadStream(JAR_PATH)
      .pipe(Parse())
      .on('entry', async (entry) => {
        const fileName = entry.path;
        const type = entry.type;
        
        if (type === 'Directory') {
          entry.autodrain();
          return;
        }
        
        const ext = extname(fileName).toLowerCase();
        const baseName = fileName.split('/').pop();
        
        let category = 'other';
        let outputPath = join(OUTPUT_DIR, fileName);
        
        // Categorize files
        if (['.png', '.gif', '.jpg', '.jpeg', '.bmp'].includes(ext)) {
          category = 'images';
          outputPath = join(OUTPUT_DIR, 'images', baseName);
          resources.images.push(fileName);
        } else if (['.dat', '.bin', '.res', '.pak', '.spr', '.til', '.map', '.lvl', '.pal'].includes(ext)) {
          category = 'data';
          outputPath = join(OUTPUT_DIR, 'data', baseName);
          resources.data.push(fileName);
        } else if (ext === '.class') {
          category = 'classes';
          outputPath = join(OUTPUT_DIR, 'classes', baseName);
          resources.classes.push(fileName);
        } else {
          resources.other.push(fileName);
        }
        
        // Extract file
        const chunks = [];
        entry.on('data', chunk => chunks.push(chunk));
        entry.on('end', async () => {
          const buffer = Buffer.concat(chunks);
          try {
            await mkdir(join(outputPath, '..'), { recursive: true });
            await writeFile(outputPath, buffer);
            console.log(`Extracted: ${fileName} -> ${outputPath}`);
          } catch (err) {
            console.error(`Error extracting ${fileName}:`, err.message);
          }
        });
      })
      .on('close', () => {
        console.log('\n=== Extraction Summary ===');
        console.log(`Images: ${resources.images.length}`);
        console.log(`Data files: ${resources.data.length}`);
        console.log(`Classes: ${resources.classes.length}`);
        console.log(`Other: ${resources.other.length}`);
        
        console.log('\n=== Image Files ===');
        resources.images.forEach(f => console.log(`  - ${f}`));
        
        console.log('\n=== Data Files (potential sprite data) ===');
        resources.data.forEach(f => console.log(`  - ${f}`));
        
        resolve(resources);
      })
      .on('error', reject);
  });
}

extractJarContents().catch(console.error);
