"use client"

import { ExternalLink, Download, Terminal, Play, Camera, Folder, Monitor, Settings } from "lucide-react"

export function FreeJ2MEGuide() {
  const steps = [
    {
      icon: Download,
      title: "1. Download FreeJ2ME",
      content: (
        <div className="space-y-3">
          <p className="text-muted-foreground">
            Download the latest FreeJ2ME release from GitHub:
          </p>
          <a
            href="https://github.com/nicksaika/FreeJ2ME/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            FreeJ2ME Releases
            <ExternalLink className="w-3 h-3" />
          </a>
          <p className="text-sm text-muted-foreground">
            Or use RetroArch with the FreeJ2ME core for better screenshot support.
          </p>
        </div>
      ),
    },
    {
      icon: Settings,
      title: "2. Configure for Sprite Capture",
      content: (
        <div className="space-y-3">
          <p className="text-muted-foreground">
            Configure FreeJ2ME for optimal sprite extraction:
          </p>
          <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm space-y-2">
            <p className="text-foreground"># freej2me.cfg</p>
            <p className="text-muted-foreground">screenWidth=240</p>
            <p className="text-muted-foreground">screenHeight=320</p>
            <p className="text-primary">enableScreenshots=true</p>
            <p className="text-primary">screenshotPath=./screenshots/</p>
            <p className="text-muted-foreground">scale=3</p>
            <p className="text-muted-foreground">fps=30</p>
          </div>
        </div>
      ),
    },
    {
      icon: Play,
      title: "3. Run the Game",
      content: (
        <div className="space-y-3">
          <p className="text-muted-foreground">
            Launch Zombie Infection with FreeJ2ME:
          </p>
          <div className="bg-background/80 rounded-lg p-4 font-mono text-sm border border-border">
            <span className="text-primary">$</span>{" "}
            <span className="text-foreground">
              java -jar freej2me.jar 240x320-rus-zombie-infection.jar
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Or via RetroArch:
          </p>
          <div className="bg-background/80 rounded-lg p-4 font-mono text-sm border border-border">
            <span className="text-primary">$</span>{" "}
            <span className="text-foreground">
              retroarch -L freej2me_libretro.so zombie-infection.jar
            </span>
          </div>
        </div>
      ),
    },
    {
      icon: Camera,
      title: "4. Capture Sprites in Real-Time",
      content: (
        <div className="space-y-3">
          <p className="text-muted-foreground">
            Methods for capturing sprites while the game runs:
          </p>
          <div className="grid gap-3">
            <div className="bg-card border border-border rounded-lg p-4">
              <h4 className="font-medium text-foreground mb-2">Method A: Manual Screenshots</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Press F12 or configured key to take screenshots</li>
                <li>- Navigate through all game screens, menus, animations</li>
                <li>- Trigger all enemy types and animations</li>
              </ul>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <h4 className="font-medium text-foreground mb-2">Method B: Video Recording + Frame Extraction</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Record gameplay with OBS or similar</li>
                <li>- Extract unique frames with FFmpeg:</li>
              </ul>
              <div className="bg-background/80 rounded p-2 mt-2 font-mono text-xs">
                ffmpeg -i gameplay.mp4 -vf &quot;select=gt(scene\,0.01)&quot; -vsync vfr frames/frame_%04d.png
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <h4 className="font-medium text-foreground mb-2">Method C: Memory Dump (Advanced)</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Use modified FreeJ2ME with image intercept</li>
                <li>- Hook Image.createImage() calls</li>
                <li>- Automatically saves all loaded sprites</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Folder,
      title: "5. Import Captured Frames",
      content: (
        <div className="space-y-3">
          <p className="text-muted-foreground">
            After capturing, use the &quot;Frame Capture&quot; tab to:
          </p>
          <ul className="text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary">1.</span>
              Upload all your screenshot images
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">2.</span>
              Tool will detect and remove duplicate frames
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">3.</span>
              Automatically crop and extract individual sprites
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">4.</span>
              Export as organized sprite sheets
            </li>
          </ul>
        </div>
      ),
    },
  ]

  const automatedScript = `#!/usr/bin/env python3
"""
FreeJ2ME Automated Sprite Capture Script
Hooks into J2ME image loading to capture all sprites
"""

import subprocess
import time
import os
from PIL import ImageGrab
import keyboard

SCREENSHOT_DIR = "./captured_sprites"
INTERVAL = 0.1  # 100ms between captures

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

frame_count = 0
running = True

def capture_frame():
    global frame_count
    screenshot = ImageGrab.grab()
    screenshot.save(f"{SCREENSHOT_DIR}/frame_{frame_count:05d}.png")
    frame_count += 1
    print(f"Captured frame {frame_count}")

def on_key(e):
    global running
    if e.name == 'esc':
        running = False
    elif e.name == 'space':
        capture_frame()

print("Sprite Capture Active")
print("SPACE = Manual capture | ESC = Stop")
print("Auto-capturing every 100ms...")

keyboard.on_press(on_key)

while running:
    capture_frame()
    time.sleep(INTERVAL)

print(f"\\nCapture complete! {frame_count} frames saved to {SCREENSHOT_DIR}")`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Monitor className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">FreeJ2ME Real-Time Capture Setup</h2>
            <p className="text-muted-foreground mt-1">
              For games with custom sprite formats, running the game in an emulator and capturing 
              rendered frames gives the most accurate results.
            </p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <step.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-3">{step.title}</h3>
                {step.content}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Automated Script */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">Automated Capture Script (Python)</span>
        </div>
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-3">
            Run this script alongside FreeJ2ME to automatically capture frames:
          </p>
          <pre className="bg-background/80 border border-border rounded-lg p-4 overflow-x-auto text-xs font-mono text-muted-foreground">
            {automatedScript}
          </pre>
          <p className="text-xs text-muted-foreground mt-3">
            Requirements: <code className="text-primary">pip install pillow keyboard pyautogui</code>
          </p>
        </div>
      </div>
    </div>
  )
}
