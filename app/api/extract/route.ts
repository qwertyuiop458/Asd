import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import AdmZip from 'adm-zip';

const JAR_PATH = join(process.cwd(), '240x320-rus-zombie-infection.jar');
const OUTPUT_DIR = join(process.cwd(), 'public/extracted_sprites');

// Image signatures
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const GIF87_SIG = Buffer.from('GIF87a');
const GIF89_SIG = Buffer.from('GIF89a');

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

function findPNGsInBuffer(buffer: Buffer) {
  const results: { offset: number; data: Buffer }[] = [];
  let pos = 0;
  
  while (pos < buffer.length - 8) {
    const idx = buffer.indexOf(PNG_SIG, pos);
    if (idx === -1) break;
    
    const iendIdx = buffer.indexOf('IEND', idx);
    if (iendIdx !== -1) {
      const endPos = iendIdx + 12;
      results.push({
        offset: idx,
        data: buffer.subarray(idx, Math.min(endPos, buffer.length))
      });
    }
    pos = idx + 1;
  }
  
  return results;
}

function findGIFsInBuffer(buffer: Buffer) {
  const results: { offset: number; data: Buffer }[] = [];
  
  for (const sig of [GIF87_SIG, GIF89_SIG]) {
    let pos = 0;
    while (pos < buffer.length - 6) {
      const idx = buffer.indexOf(sig, pos);
      if (idx === -1) break;
      
      let endPos = idx + 6;
      while (endPos < buffer.length && buffer[endPos] !== 0x3B) {
        endPos++;
      }
      if (endPos < buffer.length) {
        results.push({
          offset: idx,
          data: buffer.subarray(idx, endPos + 1)
        });
      }
      pos = idx + 1;
    }
  }
  
  return results;
}

export async function GET() {
  const logs: string[] = [];
  
  console.log("[v0] Starting extraction...");
  console.log("[v0] JAR_PATH:", JAR_PATH);
  console.log("[v0] OUTPUT_DIR:", OUTPUT_DIR);
  
  try {
    logs.push('='.repeat(60));
    logs.push('ZOMBIE INFECTION SPRITE EXTRACTOR');
    logs.push('='.repeat(60));
    
    ensureDir(OUTPUT_DIR);
    ensureDir(join(OUTPUT_DIR, 'direct_images'));
    ensureDir(join(OUTPUT_DIR, 'embedded_images'));
    
    if (!existsSync(JAR_PATH)) {
      console.log("[v0] JAR file not found!");
      return NextResponse.json({ error: `JAR not found at ${JAR_PATH}`, logs });
    }
    
    console.log("[v0] JAR file found!");
    
    const jarBuffer = readFileSync(JAR_PATH);
    logs.push(`JAR file size: ${jarBuffer.length} bytes`);
    
    const zip = new AdmZip(JAR_PATH);
    const entries = zip.getEntries();
    
    let directImages = 0;
    let embeddedImages = 0;
    const extractedFiles: string[] = [];
    
    logs.push(`Total entries in JAR: ${entries.length}`);
    logs.push('');
    logs.push('--- FILES IN JAR ---');
    
    for (const entry of entries) {
      const name = entry.entryName;
      const ext = name.split('.').pop()?.toLowerCase() || '';
      const data = entry.getData();
      
      logs.push(`  ${name} (${data.length} bytes)`);
      
      // Direct images
      if (['png', 'gif', 'jpg', 'jpeg', 'bmp'].includes(ext)) {
        const safeName = name.replace(/[\/\\]/g, '_');
        const outPath = join(OUTPUT_DIR, 'direct_images', safeName);
        writeFileSync(outPath, data);
        logs.push(`    -> DIRECT IMAGE extracted`);
        extractedFiles.push(`/extracted_sprites/direct_images/${safeName}`);
        directImages++;
      }
      
      // Check for embedded images
      const pngs = findPNGsInBuffer(data);
      const gifs = findGIFsInBuffer(data);
      
      for (let i = 0; i < pngs.length; i++) {
        const safeName = name.replace(/[\/\\]/g, '_').replace(/\.[^.]+$/, '');
        const fileName = `${safeName}_png_${i}_offset_${pngs[i].offset}.png`;
        const outPath = join(OUTPUT_DIR, 'embedded_images', fileName);
        writeFileSync(outPath, pngs[i].data);
        logs.push(`    -> EMBEDDED PNG at offset ${pngs[i].offset}`);
        extractedFiles.push(`/extracted_sprites/embedded_images/${fileName}`);
        embeddedImages++;
      }
      
      for (let i = 0; i < gifs.length; i++) {
        const safeName = name.replace(/[\/\\]/g, '_').replace(/\.[^.]+$/, '');
        const fileName = `${safeName}_gif_${i}_offset_${gifs[i].offset}.gif`;
        const outPath = join(OUTPUT_DIR, 'embedded_images', fileName);
        writeFileSync(outPath, gifs[i].data);
        logs.push(`    -> EMBEDDED GIF at offset ${gifs[i].offset}`);
        extractedFiles.push(`/extracted_sprites/embedded_images/${fileName}`);
        embeddedImages++;
      }
    }
    
    // Deep scan
    logs.push('');
    logs.push('--- DEEP SCAN OF JAR BINARY ---');
    
    const jarPngs = findPNGsInBuffer(jarBuffer);
    const jarGifs = findGIFsInBuffer(jarBuffer);
    
    logs.push(`Found ${jarPngs.length} PNG signatures in JAR binary`);
    logs.push(`Found ${jarGifs.length} GIF signatures in JAR binary`);
    
    for (let i = 0; i < jarPngs.length; i++) {
      const fileName = `jar_deep_png_${i}_offset_${jarPngs[i].offset}.png`;
      const outPath = join(OUTPUT_DIR, 'embedded_images', fileName);
      writeFileSync(outPath, jarPngs[i].data);
      extractedFiles.push(`/extracted_sprites/embedded_images/${fileName}`);
      logs.push(`  Saved PNG #${i} (${jarPngs[i].data.length} bytes)`);
    }
    
    for (let i = 0; i < jarGifs.length; i++) {
      const fileName = `jar_deep_gif_${i}_offset_${jarGifs[i].offset}.gif`;
      const outPath = join(OUTPUT_DIR, 'embedded_images', fileName);
      writeFileSync(outPath, jarGifs[i].data);
      extractedFiles.push(`/extracted_sprites/embedded_images/${fileName}`);
      logs.push(`  Saved GIF #${i} (${jarGifs[i].data.length} bytes)`);
    }
    
    logs.push('');
    logs.push('='.repeat(60));
    logs.push('EXTRACTION COMPLETE');
    logs.push('='.repeat(60));
    logs.push(`Direct images: ${directImages}`);
    logs.push(`Embedded images: ${embeddedImages + jarPngs.length + jarGifs.length}`);
    
    return NextResponse.json({ 
      success: true,
      directImages,
      embeddedImages: embeddedImages + jarPngs.length + jarGifs.length,
      totalFiles: entries.length,
      extractedFiles,
      logs 
    });
    
  } catch (error) {
    logs.push(`ERROR: ${error}`);
    return NextResponse.json({ error: String(error), logs }, { status: 500 });
  }
}
