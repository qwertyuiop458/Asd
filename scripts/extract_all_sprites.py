#!/usr/bin/env python3
"""
Deep sprite extractor for J2ME JAR files
Extracts all possible image data including embedded sprites in class files
"""

import zipfile
import os
import struct
from pathlib import Path

JAR_PATH = "/vercel/share/v0-project/240x320-rus-zombie-infection.jar"
OUTPUT_DIR = "/vercel/share/v0-project/extracted_sprites"

# Image signatures
PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'
GIF_SIGNATURE_87a = b'GIF87a'
GIF_SIGNATURE_89a = b'GIF89a'
JPEG_SIGNATURE = b'\xff\xd8\xff'
BMP_SIGNATURE = b'BM'

def ensure_dir(path):
    Path(path).mkdir(parents=True, exist_ok=True)

def find_png_in_data(data, start=0):
    """Find PNG image in binary data"""
    images = []
    pos = start
    while True:
        idx = data.find(PNG_SIGNATURE, pos)
        if idx == -1:
            break
        # Find IEND chunk
        iend_pos = data.find(b'IEND', idx)
        if iend_pos != -1:
            # IEND chunk is 12 bytes total (4 length + 4 type + 4 crc)
            end_pos = iend_pos + 12
            images.append((idx, data[idx:end_pos]))
        pos = idx + 1
    return images

def find_gif_in_data(data, start=0):
    """Find GIF image in binary data"""
    images = []
    for sig in [GIF_SIGNATURE_87a, GIF_SIGNATURE_89a]:
        pos = start
        while True:
            idx = data.find(sig, pos)
            if idx == -1:
                break
            # Find GIF trailer (0x3B)
            end_pos = data.find(b'\x00\x3b', idx)
            if end_pos != -1:
                images.append((idx, data[idx:end_pos+2]))
            elif data.find(b'\x3b', idx) != -1:
                end_pos = data.find(b'\x3b', idx)
                images.append((idx, data[idx:end_pos+1]))
            pos = idx + 1
    return images

def analyze_class_file(data, filename):
    """Analyze class file for embedded image data"""
    images = []
    
    # Look for PNG signatures
    png_images = find_png_in_data(data)
    for offset, img_data in png_images:
        images.append({
            'type': 'png',
            'offset': offset,
            'data': img_data,
            'source': filename
        })
    
    # Look for GIF signatures
    gif_images = find_gif_in_data(data)
    for offset, img_data in gif_images:
        images.append({
            'type': 'gif',
            'offset': offset,
            'data': img_data,
            'source': filename
        })
    
    return images

def extract_raw_image_data(data, filename):
    """Extract raw pixel data that might be sprite data"""
    # Nokia/Gameloft games often store sprites as raw indexed color data
    # Look for patterns that might indicate sprite data
    results = []
    
    # Check for repeated patterns (common in sprite sheets)
    if len(data) >= 64:  # Minimum size for a small sprite
        # Check if this could be raw pixel data (values 0-255)
        # Look for patterns suggesting indexed color
        pass
    
    return results

def main():
    print("=" * 60)
    print("ZOMBIE INFECTION SPRITE EXTRACTOR")
    print("=" * 60)
    
    ensure_dir(OUTPUT_DIR)
    ensure_dir(f"{OUTPUT_DIR}/direct_images")
    ensure_dir(f"{OUTPUT_DIR}/embedded_images")
    ensure_dir(f"{OUTPUT_DIR}/raw_data")
    
    if not os.path.exists(JAR_PATH):
        print(f"ERROR: JAR file not found at {JAR_PATH}")
        return
    
    print(f"\nAnalyzing: {JAR_PATH}")
    print(f"File size: {os.path.getsize(JAR_PATH)} bytes")
    
    all_files = []
    direct_images = []
    embedded_images = []
    class_files = []
    
    with zipfile.ZipFile(JAR_PATH, 'r') as jar:
        for info in jar.infolist():
            all_files.append(info.filename)
            ext = info.filename.lower().split('.')[-1] if '.' in info.filename else ''
            
            # Direct image files
            if ext in ['png', 'gif', 'jpg', 'jpeg', 'bmp']:
                direct_images.append(info.filename)
                data = jar.read(info.filename)
                safe_name = info.filename.replace('/', '_').replace('\\', '_')
                output_path = f"{OUTPUT_DIR}/direct_images/{safe_name}"
                with open(output_path, 'wb') as f:
                    f.write(data)
                print(f"  [DIRECT] Extracted: {info.filename} ({len(data)} bytes)")
            
            # Class files - check for embedded images
            elif ext == 'class':
                class_files.append(info.filename)
                data = jar.read(info.filename)
                found = analyze_class_file(data, info.filename)
                if found:
                    for i, img in enumerate(found):
                        embedded_images.append(img)
                        safe_name = info.filename.replace('/', '_').replace('\\', '_').replace('.class', '')
                        output_path = f"{OUTPUT_DIR}/embedded_images/{safe_name}_offset{img['offset']}.{img['type']}"
                        with open(output_path, 'wb') as f:
                            f.write(img['data'])
                        print(f"  [EMBEDDED] Found {img['type'].upper()} in {info.filename} at offset {img['offset']}")
            
            # Other binary files that might contain images
            elif ext in ['dat', 'bin', 'res', 'pak', 'spr', 'sprite', 'gfx', 'img', '']:
                data = jar.read(info.filename)
                
                # Check for embedded images
                png_found = find_png_in_data(data)
                gif_found = find_gif_in_data(data)
                
                for j, (offset, img_data) in enumerate(png_found):
                    safe_name = info.filename.replace('/', '_').replace('\\', '_')
                    output_path = f"{OUTPUT_DIR}/embedded_images/{safe_name}_png_{j}.png"
                    with open(output_path, 'wb') as f:
                        f.write(img_data)
                    print(f"  [BINARY] Found PNG in {info.filename} at offset {offset}")
                
                for j, (offset, img_data) in enumerate(gif_found):
                    safe_name = info.filename.replace('/', '_').replace('\\', '_')
                    output_path = f"{OUTPUT_DIR}/embedded_images/{safe_name}_gif_{j}.gif"
                    with open(output_path, 'wb') as f:
                        f.write(img_data)
                    print(f"  [BINARY] Found GIF in {info.filename} at offset {offset}")
                
                # Save raw data for manual inspection
                if len(data) > 100 and ext not in ['class']:
                    safe_name = info.filename.replace('/', '_').replace('\\', '_')
                    output_path = f"{OUTPUT_DIR}/raw_data/{safe_name}"
                    with open(output_path, 'wb') as f:
                        f.write(data)
    
    # Also scan the entire JAR as binary for any missed images
    print("\n[DEEP SCAN] Scanning entire JAR binary...")
    with open(JAR_PATH, 'rb') as f:
        jar_data = f.read()
    
    deep_png = find_png_in_data(jar_data)
    deep_gif = find_gif_in_data(jar_data)
    
    for i, (offset, img_data) in enumerate(deep_png):
        output_path = f"{OUTPUT_DIR}/embedded_images/jar_deep_scan_png_{i}_offset_{offset}.png"
        with open(output_path, 'wb') as f:
            f.write(img_data)
        print(f"  [DEEP] PNG at JAR offset {offset} ({len(img_data)} bytes)")
    
    for i, (offset, img_data) in enumerate(deep_gif):
        output_path = f"{OUTPUT_DIR}/embedded_images/jar_deep_scan_gif_{i}_offset_{offset}.gif"
        with open(output_path, 'wb') as f:
            f.write(img_data)
        print(f"  [DEEP] GIF at JAR offset {offset} ({len(img_data)} bytes)")
    
    # Summary
    print("\n" + "=" * 60)
    print("EXTRACTION SUMMARY")
    print("=" * 60)
    print(f"Total files in JAR: {len(all_files)}")
    print(f"Class files: {len(class_files)}")
    print(f"Direct images found: {len(direct_images)}")
    print(f"Embedded images found: {len(embedded_images)}")
    print(f"Deep scan PNG: {len(deep_png)}")
    print(f"Deep scan GIF: {len(deep_gif)}")
    print(f"\nOutput directory: {OUTPUT_DIR}")
    
    # List all files in JAR
    print("\n" + "=" * 60)
    print("ALL FILES IN JAR:")
    print("=" * 60)
    for f in sorted(all_files):
        print(f"  {f}")

if __name__ == "__main__":
    main()
