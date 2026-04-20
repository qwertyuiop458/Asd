"use client"

import { useState, useCallback, useRef } from "react"
import { Upload, Trash2, Crop, Wand2, Download, ZoomIn, ZoomOut, RotateCcw, Grid } from "lucide-react"

interface SpriteCaptureProps {
  onFramesCaptured: (frames: string[]) => void
  capturedFrames: string[]
}

interface SpriteRegion {
  x: number
  y: number
  width: number
  height: number
  data: string
}

export function SpriteCapture({ onFramesCaptured, capturedFrames }: SpriteCaptureProps) {
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [extractedSprites, setExtractedSprites] = useState<SpriteRegion[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [zoom, setZoom] = useState(2)
  const [gridSize, setGridSize] = useState(16)
  const [showGrid, setShowGrid] = useState(true)
  const [bgColor, setBgColor] = useState<string>("#000000")
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (!files) return

      const newImages: string[] = []

      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue

        const reader = new FileReader()
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsDataURL(file)
        })

        newImages.push(dataUrl)
      }

      setUploadedImages((prev) => [...prev, ...newImages])
      onFramesCaptured([...capturedFrames, ...newImages])
    },
    [capturedFrames, onFramesCaptured]
  )

  const detectBackgroundColor = (imageData: ImageData): string => {
    // Sample corners to detect background color
    const corners = [
      { x: 0, y: 0 },
      { x: imageData.width - 1, y: 0 },
      { x: 0, y: imageData.height - 1 },
      { x: imageData.width - 1, y: imageData.height - 1 },
    ]

    const colors: Record<string, number> = {}

    for (const corner of corners) {
      const idx = (corner.y * imageData.width + corner.x) * 4
      const r = imageData.data[idx]
      const g = imageData.data[idx + 1]
      const b = imageData.data[idx + 2]
      const key = `${r},${g},${b}`
      colors[key] = (colors[key] || 0) + 1
    }

    const mostCommon = Object.entries(colors).sort((a, b) => b[1] - a[1])[0]
    if (mostCommon) {
      const [r, g, b] = mostCommon[0].split(",").map(Number)
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
    }

    return "#000000"
  }

  const extractSpritesFromImage = useCallback(
    async (imageSrc: string) => {
      setIsProcessing(true)

      const img = new Image()
      img.crossOrigin = "anonymous"

      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.src = imageSrc
      })

      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      const detectedBg = detectBackgroundColor(imageData)
      setBgColor(detectedBg)

      // Parse background color
      const bgR = parseInt(detectedBg.slice(1, 3), 16)
      const bgG = parseInt(detectedBg.slice(3, 5), 16)
      const bgB = parseInt(detectedBg.slice(5, 7), 16)

      // Find non-background regions using flood fill approach
      const visited = new Set<string>()
      const regions: SpriteRegion[] = []
      const tolerance = 30

      const isBackground = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= img.width || y >= img.height) return true
        const idx = (y * img.width + x) * 4
        const r = imageData.data[idx]
        const g = imageData.data[idx + 1]
        const b = imageData.data[idx + 2]
        return (
          Math.abs(r - bgR) < tolerance &&
          Math.abs(g - bgG) < tolerance &&
          Math.abs(b - bgB) < tolerance
        )
      }

      // Scan for sprite regions
      for (let y = 0; y < img.height; y += 2) {
        for (let x = 0; x < img.width; x += 2) {
          const key = `${x},${y}`
          if (visited.has(key) || isBackground(x, y)) continue

          // Found a non-background pixel, expand to find bounds
          let minX = x,
            maxX = x,
            minY = y,
            maxY = y

          const stack = [[x, y]]
          while (stack.length > 0) {
            const [cx, cy] = stack.pop()!
            const k = `${cx},${cy}`
            if (visited.has(k)) continue
            if (isBackground(cx, cy)) continue
            visited.add(k)

            minX = Math.min(minX, cx)
            maxX = Math.max(maxX, cx)
            minY = Math.min(minY, cy)
            maxY = Math.max(maxY, cy)

            // Check neighbors (4-connected for speed)
            if (cx > 0) stack.push([cx - 1, cy])
            if (cx < img.width - 1) stack.push([cx + 1, cy])
            if (cy > 0) stack.push([cx, cy - 1])
            if (cy < img.height - 1) stack.push([cx, cy + 1])
          }

          const width = maxX - minX + 1
          const height = maxY - minY + 1

          // Filter out tiny regions (noise)
          if (width > 4 && height > 4) {
            // Extract sprite
            const spriteCanvas = document.createElement("canvas")
            spriteCanvas.width = width
            spriteCanvas.height = height
            const spriteCtx = spriteCanvas.getContext("2d")!
            spriteCtx.drawImage(canvas, minX, minY, width, height, 0, 0, width, height)

            regions.push({
              x: minX,
              y: minY,
              width,
              height,
              data: spriteCanvas.toDataURL("image/png"),
            })
          }
        }
      }

      // Merge overlapping regions
      const mergedRegions: SpriteRegion[] = []
      const used = new Set<number>()

      for (let i = 0; i < regions.length; i++) {
        if (used.has(i)) continue

        let merged = { ...regions[i] }

        for (let j = i + 1; j < regions.length; j++) {
          if (used.has(j)) continue

          const other = regions[j]
          // Check if regions overlap or are close
          const overlap =
            merged.x < other.x + other.width + 4 &&
            merged.x + merged.width + 4 > other.x &&
            merged.y < other.y + other.height + 4 &&
            merged.y + merged.height + 4 > other.y

          if (overlap) {
            // Merge
            const newX = Math.min(merged.x, other.x)
            const newY = Math.min(merged.y, other.y)
            merged = {
              x: newX,
              y: newY,
              width: Math.max(merged.x + merged.width, other.x + other.width) - newX,
              height: Math.max(merged.y + merged.height, other.y + other.height) - newY,
              data: "",
            }
            used.add(j)
          }
        }

        // Re-extract merged region
        const spriteCanvas = document.createElement("canvas")
        spriteCanvas.width = merged.width
        spriteCanvas.height = merged.height
        const spriteCtx = spriteCanvas.getContext("2d")!
        spriteCtx.drawImage(
          canvas,
          merged.x,
          merged.y,
          merged.width,
          merged.height,
          0,
          0,
          merged.width,
          merged.height
        )
        merged.data = spriteCanvas.toDataURL("image/png")

        mergedRegions.push(merged)
      }

      setExtractedSprites(mergedRegions)
      setIsProcessing(false)
    },
    []
  )

  const extractByGrid = useCallback(
    async (imageSrc: string) => {
      setIsProcessing(true)

      const img = new Image()
      img.crossOrigin = "anonymous"

      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.src = imageSrc
      })

      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0)

      const regions: SpriteRegion[] = []

      for (let y = 0; y < img.height; y += gridSize) {
        for (let x = 0; x < img.width; x += gridSize) {
          const w = Math.min(gridSize, img.width - x)
          const h = Math.min(gridSize, img.height - y)

          const spriteCanvas = document.createElement("canvas")
          spriteCanvas.width = w
          spriteCanvas.height = h
          const spriteCtx = spriteCanvas.getContext("2d")!
          spriteCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h)

          // Check if tile is not empty (all same color)
          const spriteData = spriteCtx.getImageData(0, 0, w, h)
          const firstPixel = [
            spriteData.data[0],
            spriteData.data[1],
            spriteData.data[2],
          ]
          let hasContent = false

          for (let i = 4; i < spriteData.data.length; i += 4) {
            if (
              Math.abs(spriteData.data[i] - firstPixel[0]) > 5 ||
              Math.abs(spriteData.data[i + 1] - firstPixel[1]) > 5 ||
              Math.abs(spriteData.data[i + 2] - firstPixel[2]) > 5
            ) {
              hasContent = true
              break
            }
          }

          if (hasContent) {
            regions.push({
              x,
              y,
              width: w,
              height: h,
              data: spriteCanvas.toDataURL("image/png"),
            })
          }
        }
      }

      setExtractedSprites(regions)
      setIsProcessing(false)
    },
    [gridSize]
  )

  const clearAll = () => {
    setUploadedImages([])
    setSelectedImage(null)
    setExtractedSprites([])
    onFramesCaptured([])
  }

  const downloadSprites = () => {
    extractedSprites.forEach((sprite, i) => {
      const link = document.createElement("a")
      link.href = sprite.data
      link.download = `sprite_${i.toString().padStart(3, "0")}_${sprite.width}x${sprite.height}.png`
      link.click()
    })
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-card/50 hover:border-primary/50 transition-colors">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          className="hidden"
          id="frame-upload"
        />
        <label htmlFor="frame-upload" className="cursor-pointer block">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-medium text-foreground">Upload Captured Frames</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload screenshots from FreeJ2ME to extract sprites
              </p>
            </div>
          </div>
        </label>
      </div>

      {/* Toolbar */}
      {uploadedImages.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-card border border-border rounded-lg">
          <span className="text-sm text-muted-foreground">
            {uploadedImages.length} frame(s) uploaded
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Grid:</label>
            <select
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
              className="bg-muted border border-border rounded px-2 py-1 text-sm text-foreground"
            >
              <option value={8}>8x8</option>
              <option value={16}>16x16</option>
              <option value={24}>24x24</option>
              <option value={32}>32x32</option>
              <option value={48}>48x48</option>
              <option value={64}>64x64</option>
            </select>
          </div>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2 rounded ${showGrid ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 border-l border-border pl-3">
            <button
              onClick={() => setZoom(Math.max(1, zoom - 1))}
              className="p-2 rounded bg-muted text-muted-foreground hover:text-foreground"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm text-muted-foreground w-8 text-center">{zoom}x</span>
            <button
              onClick={() => setZoom(Math.min(8, zoom + 1))}
              className="p-2 rounded bg-muted text-muted-foreground hover:text-foreground"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={clearAll}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-destructive/10 text-destructive rounded hover:bg-destructive/20"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      )}

      {/* Image Thumbnails */}
      {uploadedImages.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
          {uploadedImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelectedImage(img)}
              className={`aspect-square bg-muted rounded border-2 overflow-hidden transition-colors ${
                selectedImage === img ? "border-primary" : "border-border hover:border-primary/50"
              }`}
            >
              <img
                src={img}
                alt={`Frame ${i}`}
                className="w-full h-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Selected Image Workspace */}
      {selectedImage && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-medium text-foreground">Selected Frame</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => extractSpritesFromImage(selectedImage)}
                disabled={isProcessing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
              >
                <Wand2 className="w-4 h-4" />
                Auto-Extract
              </button>
              <button
                onClick={() => extractByGrid(selectedImage)}
                disabled={isProcessing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-50"
              >
                <Crop className="w-4 h-4" />
                Grid Extract
              </button>
            </div>
          </div>
          <div className="p-4 overflow-auto max-h-96" style={{ backgroundColor: bgColor }}>
            <div className="relative inline-block">
              <img
                src={selectedImage}
                alt="Selected"
                className="block"
                style={{
                  imageRendering: "pixelated",
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                }}
              />
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `
                      linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px`,
                    transform: `scale(${zoom})`,
                    transformOrigin: "top left",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Extracted Sprites */}
      {extractedSprites.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-medium text-foreground">
              Extracted Sprites ({extractedSprites.length})
            </h3>
            <button
              onClick={downloadSprites}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              <Download className="w-4 h-4" />
              Download All
            </button>
          </div>
          <div className="p-4 grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-3">
            {extractedSprites.map((sprite, i) => (
              <div
                key={i}
                className="aspect-square bg-muted rounded border border-border flex items-center justify-center overflow-hidden pixel-grid group relative"
              >
                <img
                  src={sprite.data}
                  alt={`Sprite ${i}`}
                  className="max-w-full max-h-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-xs text-foreground">
                  <span>{sprite.width}x{sprite.height}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 flex items-center gap-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-foreground">Extracting sprites...</span>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
