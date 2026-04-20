# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow"]
# ///

"""
Deep binary analysis of Zombie Infection JAR
Gameloft games use proprietary sprite formats - need to reverse engineer
"""

import zipfile
import os
import struct
from pathlib import Path

JAR_PATH = "/vercel/share/v0-project/240x320-rus-zombie-infection.jar"
OUTPUT_DIR = "/vercel/share/v0-project/public/sprites"

def analyze_jar():
    print(f"=== Analyzing JAR: {JAR_PATH} ===\n")
    
    if not os.path.exists(JAR_PATH):
        print(f"ERROR: JAR not found at {JAR_PATH}")
        return
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    with zipfile.ZipFile(JAR_PATH, 'r') as jar:
        files = jar.namelist()
        print(f"Total files in JAR: {len(files)}\n")
        
        # Categorize files
        classes = []
        resources = []
        
        for f in files:
            if f.endswith('.class'):
                classes.append(f)
            elif not f.endswith('/'):
                resources.append(f)
        
        print(f"Class files: {len(classes)}")
        print(f"Resource files: {len(resources)}\n")
        
        print("=== Resource files ===")
        for r in resources:
            info = jar.getinfo(r)
            print(f"  {r} ({info.file_size} bytes)")
        
        print("\n=== Analyzing resource content ===\n")
        
        found_images = []
        
        for r in resources:
            data = jar.read(r)
            print(f"\n--- {r} ({len(data)} bytes) ---")
            
            # Check file signatures
            if data[:8] == b'\x89PNG\r\n\x1a\n':
                print("  -> PNG image!")
                save_path = os.path.join(OUTPUT_DIR, os.path.basename(r) + '.png')
                with open(save_path, 'wb') as f:
                    f.write(data)
                found_images.append(save_path)
                
            elif data[:6] in (b'GIF87a', b'GIF89a'):
                print("  -> GIF image!")
                save_path = os.path.join(OUTPUT_DIR, os.path.basename(r) + '.gif')
                with open(save_path, 'wb') as f:
                    f.write(data)
                found_images.append(save_path)
                
            else:
                # Print first 64 bytes as hex
                print(f"  Header (hex): {data[:32].hex()}")
                print(f"  Header (raw): {data[:32]}")
                
                # Look for embedded images
                png_pos = data.find(b'\x89PNG\r\n\x1a\n')
                gif_pos = data.find(b'GIF8')
                
                if png_pos != -1:
                    print(f"  -> Found PNG at offset {png_pos}")
                if gif_pos != -1:
                    print(f"  -> Found GIF at offset {gif_pos}")
                
                # Analyze structure for Gameloft format
                if len(data) > 4:
                    # Try different interpretations
                    try:
                        val_be = struct.unpack('>I', data[:4])[0]
                        val_le = struct.unpack('<I', data[:4])[0]
                        val_h1 = struct.unpack('>H', data[:2])[0]
                        val_h2 = struct.unpack('>H', data[2:4])[0]
                        print(f"  First 4 bytes as: BE_uint32={val_be}, LE_uint32={val_le}")
                        print(f"  First 4 bytes as: BE_uint16[0]={val_h1}, BE_uint16[1]={val_h2}")
                        
                        # Could be width x height?
                        if 1 <= val_h1 <= 512 and 1 <= val_h2 <= 512:
                            print(f"  -> Possible dimensions: {val_h1}x{val_h2}")
                    except:
                        pass
        
        print(f"\n\n=== Scanning class files for embedded data ===\n")
        
        for cls in classes[:10]:  # First 10 classes
            data = jar.read(cls)
            png_count = data.count(b'\x89PNG')
            gif_count = data.count(b'GIF8')
            if png_count > 0 or gif_count > 0:
                print(f"{cls}: PNG={png_count}, GIF={gif_count}")
        
        # Deep scan entire JAR as binary
        print("\n=== Deep binary scan ===\n")
        
        jar_data = open(JAR_PATH, 'rb').read()
        print(f"JAR size: {len(jar_data)} bytes")
        
        # Find all PNG signatures
        pos = 0
        png_locations = []
        while True:
            pos = jar_data.find(b'\x89PNG\r\n\x1a\n', pos)
            if pos == -1:
                break
            png_locations.append(pos)
            pos += 1
        
        print(f"PNG signatures found: {len(png_locations)}")
        for i, loc in enumerate(png_locations[:20]):
            print(f"  PNG #{i+1} at offset {loc}")
            # Try to extract
            try:
                # Find IEND chunk
                iend = jar_data.find(b'IEND', loc)
                if iend != -1:
                    png_data = jar_data[loc:iend+8]
                    save_path = os.path.join(OUTPUT_DIR, f'extracted_png_{i}.png')
                    with open(save_path, 'wb') as f:
                        f.write(png_data)
                    print(f"    -> Saved to {save_path} ({len(png_data)} bytes)")
                    found_images.append(save_path)
            except Exception as e:
                print(f"    -> Error: {e}")
        
        # Find all GIF signatures
        pos = 0
        gif_locations = []
        while True:
            pos = jar_data.find(b'GIF8', pos)
            if pos == -1:
                break
            gif_locations.append(pos)
            pos += 1
        
        print(f"\nGIF signatures found: {len(gif_locations)}")
        for i, loc in enumerate(gif_locations[:20]):
            print(f"  GIF #{i+1} at offset {loc}")
        
        print(f"\n\n=== SUMMARY ===")
        print(f"Found and saved {len(found_images)} images to {OUTPUT_DIR}")
        
        if len(found_images) == 0:
            print("\nNo standard PNG/GIF images found.")
            print("Gameloft likely uses proprietary sprite format.")
            print("\nAnalyzing potential sprite data files...")
            
            # Look for raw pixel data patterns
            for r in resources:
                data = jar.read(r)
                if len(data) > 100:
                    # Check if it could be raw pixel data
                    # Common J2ME formats: 
                    # - Raw RGB565 (2 bytes per pixel)
                    # - Raw ARGB8888 (4 bytes per pixel)
                    # - Indexed palette + data
                    
                    # Look for palette-like structure at start
                    # (multiple of 3 bytes for RGB, or 4 for RGBA)
                    print(f"\n{r}:")
                    
                    # Check for repeating patterns (tile data)
                    unique_bytes = len(set(data[:256]))
                    print(f"  Unique bytes in first 256: {unique_bytes}")
                    
                    # Check entropy
                    if unique_bytes < 32:
                        print(f"  -> Low entropy - possibly indexed/compressed")
                    elif unique_bytes > 200:
                        print(f"  -> High entropy - possibly raw pixels or compressed")

if __name__ == "__main__":
    analyze_jar()
