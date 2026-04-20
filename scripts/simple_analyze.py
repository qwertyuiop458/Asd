# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

import zipfile
import os
import struct

JAR_PATH = "/vercel/share/v0-project/240x320-rus-zombie-infection.jar"
OUTPUT_DIR = "/vercel/share/v0-project/public/sprites"

print(f"Analyzing: {JAR_PATH}")
print(f"Exists: {os.path.exists(JAR_PATH)}")

if not os.path.exists(JAR_PATH):
    # List directory
    print("\nFiles in project root:")
    for f in os.listdir("/vercel/share/v0-project"):
        print(f"  {f}")
    exit(1)

os.makedirs(OUTPUT_DIR, exist_ok=True)

with zipfile.ZipFile(JAR_PATH, 'r') as jar:
    files = jar.namelist()
    print(f"\nTotal files: {len(files)}")
    
    for f in sorted(files):
        if not f.endswith('/'):
            info = jar.getinfo(f)
            data = jar.read(f)
            
            # Determine type
            file_type = "unknown"
            if f.endswith('.class'):
                file_type = "class"
            elif data[:8] == b'\x89PNG\r\n\x1a\n':
                file_type = "PNG"
            elif data[:4] == b'GIF8':
                file_type = "GIF"
            elif data[:2] == b'PK':
                file_type = "ZIP"
            
            print(f"{f}: {info.file_size} bytes, type={file_type}, header={data[:16].hex()}")
            
            # Save non-class files
            if not f.endswith('.class') and not f.endswith('/'):
                out_path = os.path.join(OUTPUT_DIR, f.replace('/', '_'))
                with open(out_path, 'wb') as out:
                    out.write(data)
                print(f"  -> Saved to {out_path}")

# Deep scan for embedded images
print("\n\n=== Deep scan for PNG/GIF signatures ===")
with open(JAR_PATH, 'rb') as f:
    data = f.read()
    
print(f"JAR total size: {len(data)} bytes")

# Find PNG
idx = 0
png_count = 0
while True:
    pos = data.find(b'\x89PNG\r\n\x1a\n', idx)
    if pos == -1:
        break
    png_count += 1
    print(f"PNG found at offset {pos}")
    
    # Extract PNG
    iend = data.find(b'IEND', pos)
    if iend != -1:
        png_data = data[pos:iend+8]
        out_path = os.path.join(OUTPUT_DIR, f'embedded_png_{png_count}.png')
        with open(out_path, 'wb') as f:
            f.write(png_data)
        print(f"  Extracted {len(png_data)} bytes to {out_path}")
    
    idx = pos + 1

# Find GIF
idx = 0
gif_count = 0
while True:
    pos = data.find(b'GIF8', idx)
    if pos == -1:
        break
    gif_count += 1
    print(f"GIF found at offset {pos}")
    idx = pos + 1

print(f"\nTotal: {png_count} PNG, {gif_count} GIF signatures found")
print(f"\nFiles saved to: {OUTPUT_DIR}")
print("Contents:")
for f in os.listdir(OUTPUT_DIR):
    size = os.path.getsize(os.path.join(OUTPUT_DIR, f))
    print(f"  {f}: {size} bytes")
