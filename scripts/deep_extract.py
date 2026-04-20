#!/usr/bin/env python3
"""
Deep J2ME JAR Sprite Extractor
Extracts all resources and analyzes binary data for embedded sprites
"""

import zipfile
import os
import struct
from pathlib import Path

JAR_PATH = "240x320-rus-zombie-infection.jar"
OUTPUT_DIR = "extracted_resources"

def create_dirs():
    dirs = ['images', 'data', 'classes', 'raw_sprites', 'analysis']
    for d in dirs:
        Path(f"{OUTPUT_DIR}/{d}").mkdir(parents=True, exist_ok=True)

def find_png_in_binary(data, filename):
    """Find embedded PNG images in binary data"""
    png_signature = b'\x89PNG\r\n\x1a\n'
    png_end = b'IEND\xaeB`\x82'
    
    images = []
    start = 0
    
    while True:
        pos = data.find(png_signature, start)
        if pos == -1:
            break
        
        end_pos = data.find(png_end, pos)
        if end_pos != -1:
            end_pos += len(png_end)
            images.append((pos, data[pos:end_pos]))
        
        start = pos + 1
    
    return images

def find_gif_in_binary(data, filename):
    """Find embedded GIF images in binary data"""
    gif_signatures = [b'GIF87a', b'GIF89a']
    images = []
    
    for sig in gif_signatures:
        start = 0
        while True:
            pos = data.find(sig, start)
            if pos == -1:
                break
            
            # GIF ends with 0x3B (;)
            end_pos = data.find(b'\x3b', pos + 6)
            if end_pos != -1:
                images.append((pos, data[pos:end_pos + 1]))
            
            start = pos + 1
    
    return images

def analyze_binary_file(data, filename):
    """Analyze binary file for potential sprite data"""
    analysis = {
        'size': len(data),
        'embedded_pngs': 0,
        'embedded_gifs': 0,
        'potential_palette': False,
        'potential_tilemap': False
    }
    
    # Check for palette data (256 RGB values = 768 bytes)
    if len(data) == 768 or len(data) == 1024:
        analysis['potential_palette'] = True
    
    # Check for tilemap patterns (repeated byte patterns)
    if len(data) > 100:
        # Count unique bytes
        unique = len(set(data[:1000]))
        if unique < 50:  # Low entropy suggests tilemap or compressed data
            analysis['potential_tilemap'] = True
    
    return analysis

def main():
    print("=" * 60)
    print("J2ME Zombie Infection - Deep Sprite Extractor")
    print("=" * 60)
    
    if not os.path.exists(JAR_PATH):
        print(f"ERROR: JAR file not found: {JAR_PATH}")
        return
    
    create_dirs()
    
    stats = {
        'images': [],
        'data_files': [],
        'classes': [],
        'embedded_images': [],
        'other': []
    }
    
    with zipfile.ZipFile(JAR_PATH, 'r') as jar:
        print(f"\nJAR Contents ({len(jar.namelist())} files):")
        print("-" * 40)
        
        for name in jar.namelist():
            if name.endswith('/'):
                continue
                
            data = jar.read(name)
            ext = os.path.splitext(name)[1].lower()
            base_name = os.path.basename(name)
            
            print(f"  {name} ({len(data)} bytes)")
            
            # Categorize and extract
            if ext in ['.png', '.gif', '.jpg', '.jpeg', '.bmp']:
                stats['images'].append(name)
                output_path = f"{OUTPUT_DIR}/images/{base_name}"
                with open(output_path, 'wb') as f:
                    f.write(data)
                print(f"    -> Extracted image: {output_path}")
                
            elif ext in ['.dat', '.bin', '.res', '.pak', '.spr', '.til', '.map', '.lvl', '.pal', '.raw']:
                stats['data_files'].append(name)
                output_path = f"{OUTPUT_DIR}/data/{base_name}"
                with open(output_path, 'wb') as f:
                    f.write(data)
                
                # Deep analysis
                analysis = analyze_binary_file(data, name)
                
                # Search for embedded images
                pngs = find_png_in_binary(data, name)
                gifs = find_gif_in_binary(data, name)
                
                if pngs:
                    print(f"    -> Found {len(pngs)} embedded PNG(s)!")
                    for i, (pos, img_data) in enumerate(pngs):
                        img_path = f"{OUTPUT_DIR}/raw_sprites/{base_name}_png_{i}.png"
                        with open(img_path, 'wb') as f:
                            f.write(img_data)
                        stats['embedded_images'].append(img_path)
                        print(f"       Saved: {img_path}")
                
                if gifs:
                    print(f"    -> Found {len(gifs)} embedded GIF(s)!")
                    for i, (pos, img_data) in enumerate(gifs):
                        img_path = f"{OUTPUT_DIR}/raw_sprites/{base_name}_gif_{i}.gif"
                        with open(img_path, 'wb') as f:
                            f.write(img_data)
                        stats['embedded_images'].append(img_path)
                        print(f"       Saved: {img_path}")
                
                if analysis['potential_palette']:
                    print(f"    -> Potential palette file!")
                if analysis['potential_tilemap']:
                    print(f"    -> Potential tilemap/sprite data!")
                    
            elif ext == '.class':
                stats['classes'].append(name)
                output_path = f"{OUTPUT_DIR}/classes/{base_name}"
                with open(output_path, 'wb') as f:
                    f.write(data)
                    
                # Search for embedded images in class files too
                pngs = find_png_in_binary(data, name)
                gifs = find_gif_in_binary(data, name)
                
                if pngs or gifs:
                    print(f"    -> Class contains embedded images!")
                    for i, (pos, img_data) in enumerate(pngs):
                        img_path = f"{OUTPUT_DIR}/raw_sprites/{base_name}_png_{i}.png"
                        with open(img_path, 'wb') as f:
                            f.write(img_data)
                        stats['embedded_images'].append(img_path)
                    for i, (pos, img_data) in enumerate(gifs):
                        img_path = f"{OUTPUT_DIR}/raw_sprites/{base_name}_gif_{i}.gif"
                        with open(img_path, 'wb') as f:
                            f.write(img_data)
                        stats['embedded_images'].append(img_path)
            else:
                stats['other'].append(name)
                # Still check for embedded images
                if len(data) > 100:
                    pngs = find_png_in_binary(data, name)
                    gifs = find_gif_in_binary(data, name)
                    if pngs or gifs:
                        print(f"    -> Contains embedded images!")
                        for i, (pos, img_data) in enumerate(pngs):
                            safe_name = base_name.replace('/', '_')
                            img_path = f"{OUTPUT_DIR}/raw_sprites/{safe_name}_png_{i}.png"
                            with open(img_path, 'wb') as f:
                                f.write(img_data)
                            stats['embedded_images'].append(img_path)
    
    # Summary
    print("\n" + "=" * 60)
    print("EXTRACTION SUMMARY")
    print("=" * 60)
    print(f"Direct images:     {len(stats['images'])}")
    print(f"Data files:        {len(stats['data_files'])}")
    print(f"Class files:       {len(stats['classes'])}")
    print(f"Embedded images:   {len(stats['embedded_images'])}")
    print(f"Other files:       {len(stats['other'])}")
    
    print(f"\nAll extracted files are in: {OUTPUT_DIR}/")
    
    if stats['images']:
        print("\n--- Direct Images ---")
        for img in stats['images']:
            print(f"  {img}")
    
    if stats['embedded_images']:
        print("\n--- Embedded Images Found ---")
        for img in stats['embedded_images']:
            print(f"  {img}")
    
    if stats['data_files']:
        print("\n--- Data Files (may contain sprite data) ---")
        for f in stats['data_files']:
            print(f"  {f}")

if __name__ == "__main__":
    main()
