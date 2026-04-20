"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Download, Settings, Grid, Layers, Play, Pause, SkipBack, SkipForward } from "lucide-react"

interface SpriteSheetProps {
  frames: string[]
  extractedSprites: string[]
}

interface SpriteInfo {
  src: string
  width: number
  height: number
}

export function SpriteSheet({ frames, extractedSprites }: SpriteSheetProps) {
  const [sprites, setSprites] = useState<SpriteInfo[]>([])
  const [columns, setColumns] = useState(8)
  const [padding, setPadding] = useState(1)
  const [bgColor, setBgColor] = useState("transparent")
  const [sheetDataUrl, setSheetDataUrl] = useState<string | null>(null)
  const [selectedSprites, setSelectedSprites] = useState<Set<number>>(new Set())
  
  // Animation preview
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [fps, setFps] = useState(12)
  const animationRef = useRef<NodeJS.Timeout | null>(null)

  // Load sprite dimensions
  useEffect(() => {
    const allSources = [...extractedSprites, ...frames]
    
    Promise.all(
      allSources.map((src) => {
        return new Promise<SpriteInfo>((resolve) => {
          const img = new Image()
          img.onload = () => {
            resolve({ src, width: img.width, height: img.height })
          }
          img.onerror = () => {
            resolve({ src, width: 32, height: 32 })
          }
          img.src = src
        })
      })
    ).then(setSprites)
  }, [frames, extractedSprites])

  // Animation loop
  useEffect(() => {
    if (isPlaying && selectedSprites.size > 1) {
      const selectedArray = Array.from(selectedSprites).sort((a, b) => a - b)
      animationRef.current = setInterval(() => {
        setCurrentFrame((prev) => {
          const currentIndex = selectedArray.indexOf(prev)
          const nextIndex = (currentIndex + 1) % selectedArray.length
          return selectedArray[nextIndex]
        })
      }, 1000 / fps)
    }

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current)
      }
    }
  }, [isPlaying, selectedSprites, fps])

  const toggleSpriteSelection = (index: number) => {
    setSelectedSprites((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedSprites(new Set(sprites.map((_, i) => i)))
  }

  const selectNone = () => {
    setSelectedSprites(new Set())
  }

  const generateSpriteSheet = useCallback(async () => {
    const selectedArray = Array.from(selectedSprites).sort((a, b) => a - b)
    const spritesToUse = selectedArray.length > 0 
      ? selectedArray.map(i => sprites[i]) 
      : sprites

    if (spritesToUse.length === 0) return

    // Calculate sheet dimensions
    const maxWidth = Math.max(...spritesToUse.map((s) => s.width))
    const maxHeight = Math.max(...spritesToUse.map((s) => s.height))
    const rows = Math.ceil(spritesToUse.length / columns)

    const sheetWidth = columns * (maxWidth + padding * 2)
    const sheetHeight = rows * (maxHeight + padding * 2)

    const canvas = document.createElement("canvas")
    canvas.width = sheetWidth
    canvas.height = sheetHeight
    const ctx = canvas.getContext("2d")!

    // Fill background
    if (bgColor !== "transparent") {
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, sheetWidth, sheetHeight)
    }

    // Draw sprites
    for (let i = 0; i < spritesToUse.length; i++) {
      const sprite = spritesToUse[i]
      const col = i % columns
      const row = Math.floor(i / columns)
      
      const x = col * (maxWidth + padding * 2) + padding
      const y = row * (maxHeight + padding * 2) + padding

      const img = new Image()
      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.src = sprite.src
      })

      // Center sprite in cell
      const offsetX = (maxWidth - sprite.width) / 2
      const offsetY = (maxHeight - sprite.height) / 2
      ctx.drawImage(img, x + offsetX, y + offsetY)
    }

    setSheetDataUrl(canvas.toDataURL("image/png"))
  }, [sprites, selectedSprites, columns, padding, bgColor])

  const downloadSheet = () => {
    if (!sheetDataUrl) return
    const link = document.createElement("a")
    link.href = sheetDataUrl
    link.download = `spritesheet_${columns}col_${sprites.length}sprites.png`
    link.click()
  }

  const downloadJson = () => {
    const selectedArray = Array.from(selectedSprites).sort((a, b) => a - b)
    const spritesToUse = selectedArray.length > 0 
      ? selectedArray.map(i => sprites[i]) 
      : sprites

    const maxWidth = Math.max(...spritesToUse.map((s) => s.width))
    const maxHeight = Math.max(...spritesToUse.map((s) => s.height))

    const metadata = {
      frames: spritesToUse.map((sprite, i) => ({
        filename: `sprite_${i.toString().padStart(3, "0")}`,
        frame: {
          x: (i % columns) * (maxWidth + padding * 2) + padding,
          y: Math.floor(i / columns) * (maxHeight + padding * 2) + padding,
          w: sprite.width,
          h: sprite.height,
        },
        sourceSize: { w: sprite.width, h: sprite.height },
      })),
      meta: {
        app: "J2ME Sprite Extractor",
        version: "1.0",
        image: "spritesheet.png",
        size: {
          w: columns * (maxWidth + padding * 2),
          h: Math.ceil(spritesToUse.length / columns) * (maxHeight + padding * 2),
        },
      },
    }

    const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "spritesheet.json"
    link.click()
  }

  if (sprites.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
          <Layers className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No Sprites Yet</h3>
        <p className="text-muted-foreground">
          Upload JAR files in &quot;JAR Analysis&quot; or capture frames in &quot;Frame Capture&quot; to generate sprite sheets.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Settings */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Settings</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Columns:</label>
            <input
              type="number"
              value={columns}
              onChange={(e) => setColumns(Math.max(1, Number(e.target.value)))}
              className="w-16 bg-muted border border-border rounded px-2 py-1 text-sm text-foreground"
              min={1}
              max={32}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Padding:</label>
            <input
              type="number"
              value={padding}
              onChange={(e) => setPadding(Math.max(0, Number(e.target.value)))}
              className="w-16 bg-muted border border-border rounded px-2 py-1 text-sm text-foreground"
              min={0}
              max={16}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Background:</label>
            <select
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="bg-muted border border-border rounded px-2 py-1 text-sm text-foreground"
            >
              <option value="transparent">Transparent</option>
              <option value="#000000">Black</option>
              <option value="#ff00ff">Magenta</option>
              <option value="#00ff00">Green</option>
              <option value="#ffffff">White</option>
            </select>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
            >
              Select None
            </button>
          </div>
          <button
            onClick={generateSpriteSheet}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            <Grid className="w-4 h-4" />
            Generate Sheet
          </button>
        </div>
      </div>

      {/* Sprite Grid */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-medium text-foreground">
            Available Sprites ({sprites.length}) - Selected: {selectedSprites.size}
          </h3>
        </div>
        <div className="p-4 grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-16 gap-2 max-h-80 overflow-y-auto">
          {sprites.map((sprite, i) => (
            <button
              key={i}
              onClick={() => toggleSpriteSelection(i)}
              className={`aspect-square bg-muted rounded border-2 flex items-center justify-center overflow-hidden pixel-grid transition-all ${
                selectedSprites.has(i)
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <img
                src={sprite.src}
                alt={`Sprite ${i}`}
                className="max-w-full max-h-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Animation Preview */}
      {selectedSprites.size > 1 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-medium text-foreground">Animation Preview</h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">FPS:</label>
                <input
                  type="number"
                  value={fps}
                  onChange={(e) => setFps(Math.max(1, Math.min(60, Number(e.target.value))))}
                  className="w-16 bg-muted border border-border rounded px-2 py-1 text-sm text-foreground"
                  min={1}
                  max={60}
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const arr = Array.from(selectedSprites).sort((a, b) => a - b)
                    const idx = arr.indexOf(currentFrame)
                    setCurrentFrame(arr[Math.max(0, idx - 1)])
                  }}
                  className="p-2 rounded bg-muted hover:bg-muted/80"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                    const arr = Array.from(selectedSprites).sort((a, b) => a - b)
                    const idx = arr.indexOf(currentFrame)
                    setCurrentFrame(arr[Math.min(arr.length - 1, idx + 1)])
                  }}
                  className="p-2 rounded bg-muted hover:bg-muted/80"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="p-8 flex items-center justify-center bg-muted/30 pixel-grid">
            <div className="w-32 h-32 flex items-center justify-center">
              {sprites[currentFrame] && (
                <img
                  src={sprites[currentFrame].src}
                  alt="Animation frame"
                  className="max-w-full max-h-full object-contain"
                  style={{ imageRendering: "pixelated", transform: "scale(2)" }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generated Sheet Preview */}
      {sheetDataUrl && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-medium text-foreground">Generated Sprite Sheet</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadJson}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
              >
                <Download className="w-4 h-4" />
                JSON Metadata
              </button>
              <button
                onClick={downloadSheet}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                <Download className="w-4 h-4" />
                Download PNG
              </button>
            </div>
          </div>
          <div
            className="p-4 overflow-auto max-h-96"
            style={{
              backgroundColor: bgColor === "transparent" ? "#1a1a2e" : bgColor,
              backgroundImage:
                bgColor === "transparent"
                  ? "linear-gradient(45deg, #2a2a3e 25%, transparent 25%), linear-gradient(-45deg, #2a2a3e 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a3e 75%), linear-gradient(-45deg, transparent 75%, #2a2a3e 75%)"
                  : "none",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
            }}
          >
            <img
              src={sheetDataUrl}
              alt="Sprite Sheet"
              className="block"
              style={{ imageRendering: "pixelated" }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
