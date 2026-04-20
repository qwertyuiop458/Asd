#!/usr/bin/env python3
"""
Script to extract sprites and graphical resources from J2ME JAR game file.
JAR files are ZIP archives containing game resources like PNG, GIF images.
"""

import zipfile
import os
import sys
from pathlib import Path

# Configuration
JAR_FILE = "/vercel/share/v0-project/240x320-rus-zombie-infection.jar"
OUTPUT_DIR = "/vercel/share/v0-project/extracted_sprites"

# Supported image extensions in J2ME games
IMAGE_EXTENSIONS = {'.png', '.gif', '.jpg', '.jpeg', '.bmp'}
# Other resource extensions that might contain sprite data
RESOURCE_EXTENSIONS = {'.bin', '.dat', '.res', '.spr', '.pak', '.raw', '.img'}

def extract_jar_contents(jar_path: str, output_dir: str):
    """Extract all contents from JAR file"""
    
    if not os.path.exists(jar_path):
        print(f"Error: JAR file not found: {jar_path}")
        return False
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Opening JAR: {jar_path}")
    print(f"Output directory: {output_dir}")
    print("-" * 60)
    
    images_found = []
    resources_found = []
    other_files = []
    
    try:
        with zipfile.ZipFile(jar_path, 'r') as jar:
            file_list = jar.namelist()
            print(f"Total files in JAR: {len(file_list)}")
            print("-" * 60)
            
            # List all files first
            print("\n📁 JAR CONTENTS:")
            for name in sorted(file_list):
                size = jar.getinfo(name).file_size
                ext = Path(name).suffix.lower()
                
                if ext in IMAGE_EXTENSIONS:
                    images_found.append((name, size))
                    print(f"  🖼️  {name} ({size} bytes)")
                elif ext in RESOURCE_EXTENSIONS:
                    resources_found.append((name, size))
                    print(f"  📦 {name} ({size} bytes)")
                elif not name.endswith('/'):  # Not a directory
                    other_files.append((name, size))
                    print(f"  📄 {name} ({size} bytes)")
            
            # Extract all files
            print("\n" + "=" * 60)
            print("EXTRACTING FILES...")
            print("=" * 60)
            
            jar.extractall(output_dir)
            
            print(f"\n✅ Extraction complete!")
            print(f"\n📊 SUMMARY:")
            print(f"  - Images found: {len(images_found)}")
            print(f"  - Resource files: {len(resources_found)}")
            print(f"  - Other files: {len(other_files)}")
            
            # Detailed image list
            if images_found:
                print(f"\n🖼️  EXTRACTED IMAGES:")
                for name, size in images_found:
                    full_path = os.path.join(output_dir, name)
                    print(f"  - {full_path}")
            
            # Check for potential sprite containers
            if resources_found:
                print(f"\n📦 POTENTIAL SPRITE CONTAINERS (binary resources):")
                for name, size in resources_found:
                    full_path = os.path.join(output_dir, name)
                    print(f"  - {full_path} ({size} bytes)")
                print("\n  ⚠️  These files may contain packed sprites that require")
                print("     game-specific decompression/unpacking.")
            
            return True
            
    except zipfile.BadZipFile:
        print(f"Error: {jar_path} is not a valid ZIP/JAR file")
        return False
    except Exception as e:
        print(f"Error extracting JAR: {e}")
        return False


def analyze_class_files(output_dir: str):
    """Analyze class files for resource loading patterns"""
    print("\n" + "=" * 60)
    print("ANALYZING CLASS FILES FOR RESOURCE PATHS...")
    print("=" * 60)
    
    class_files = list(Path(output_dir).rglob("*.class"))
    print(f"Found {len(class_files)} class files")
    
    # Look for common resource loading patterns in binary
    resource_patterns = [b'.png', b'.gif', b'.jpg', b'/res/', b'/img/', b'sprite', b'image']
    
    found_patterns = set()
    for class_file in class_files:
        try:
            with open(class_file, 'rb') as f:
                content = f.read()
                for pattern in resource_patterns:
                    if pattern in content.lower() if isinstance(pattern, bytes) else pattern.encode() in content:
                        # Try to extract the full string around the pattern
                        idx = content.lower().find(pattern)
                        if idx != -1:
                            # Extract surrounding readable chars
                            start = max(0, idx - 20)
                            end = min(len(content), idx + 50)
                            snippet = content[start:end]
                            # Filter to printable ASCII
                            readable = ''.join(chr(b) if 32 <= b < 127 else '.' for b in snippet)
                            found_patterns.add(readable)
        except Exception:
            pass
    
    if found_patterns:
        print("\nPotential resource references found in code:")
        for pattern in sorted(found_patterns)[:20]:  # Limit output
            print(f"  - {pattern}")


if __name__ == "__main__":
    print("=" * 60)
    print("J2ME JAR SPRITE EXTRACTOR")
    print("=" * 60)
    print()
    
    success = extract_jar_contents(JAR_FILE, OUTPUT_DIR)
    
    if success:
        analyze_class_files(OUTPUT_DIR)
        
        print("\n" + "=" * 60)
        print("NEXT STEPS:")
        print("=" * 60)
        print("""
1. Check 'extracted_sprites' folder for PNG/GIF images
2. If sprites are packed in .bin/.dat files, they may need
   game-specific unpacking (common in J2ME games to save space)
3. Some J2ME games store sprites as raw byte arrays in code
4. Use a hex editor to analyze binary resource files
""")
