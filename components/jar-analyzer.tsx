"use client"

import { useState, useCallback } from "react"
import { Upload, FileArchive, Image, File, AlertCircle, CheckCircle, Download } from "lucide-react"
import JSZip from "jszip"

interface ExtractedFile {
  name: string
  path: string
  size: number
  type: "image" | "data" | "class" | "other"
  data?: string // base64 for images
  embeddedImages?: { data: string; offset: number }[]
}

interface JarAnalyzerProps {
  onSpritesFound: (sprites: string[]) => void
}

export function JarAnalyzer({ onSpritesFound }: JarAnalyzerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [files, setFiles] = useState<ExtractedFile[]>([])
  const [log, setLog] = useState<string[]>([])
  const [jarName, setJarName] = useState<string>("")

  const addLog = (message: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const findPNGSignatures = (data: Uint8Array): { data: string; offset: number }[] => {
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    const pngEnd = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]
    const found: { data: string; offset: number }[] = []

    for (let i = 0; i < data.length - 8; i++) {
      let match = true
      for (let j = 0; j < 8; j++) {
        if (data[i + j] !== pngSignature[j]) {
          match = false
          break
        }
      }

      if (match) {
        // Find PNG end
        for (let e = i + 8; e < data.length - 8; e++) {
          let endMatch = true
          for (let j = 0; j < 8; j++) {
            if (data[e + j] !== pngEnd[j]) {
              endMatch = false
              break
            }
          }
          if (endMatch) {
            const pngData = data.slice(i, e + 8)
            const base64 = btoa(String.fromCharCode(...pngData))
            found.push({ data: `data:image/png;base64,${base64}`, offset: i })
            break
          }
        }
      }
    }

    return found
  }

  const findGIFSignatures = (data: Uint8Array): { data: string; offset: number }[] => {
    const gif87a = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]
    const gif89a = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]
    const found: { data: string; offset: number }[] = []

    const signatures = [gif87a, gif89a]

    for (const sig of signatures) {
      for (let i = 0; i < data.length - 6; i++) {
        let match = true
        for (let j = 0; j < 6; j++) {
          if (data[i + j] !== sig[j]) {
            match = false
            break
          }
        }

        if (match) {
          // Find GIF trailer (0x3B)
          for (let e = i + 6; e < data.length; e++) {
            if (data[e] === 0x3b) {
              const gifData = data.slice(i, e + 1)
              const base64 = btoa(String.fromCharCode(...gifData))
              found.push({ data: `data:image/gif;base64,${base64}`, offset: i })
              break
            }
          }
        }
      }
    }

    return found
  }

  const analyzeFile = async (
    name: string,
    data: Uint8Array
  ): Promise<ExtractedFile> => {
    const ext = name.split(".").pop()?.toLowerCase() || ""
    let type: ExtractedFile["type"] = "other"
    let base64Data: string | undefined
    let embeddedImages: { data: string; offset: number }[] = []

    if (["png", "gif", "jpg", "jpeg", "bmp"].includes(ext)) {
      type = "image"
      const mimeType = ext === "jpg" ? "jpeg" : ext
      base64Data = `data:image/${mimeType};base64,${btoa(String.fromCharCode(...data))}`
    } else if (["dat", "bin", "res", "pak", "spr", "til", "map", "lvl", "pal", "raw"].includes(ext)) {
      type = "data"
      // Search for embedded images
      embeddedImages = [...findPNGSignatures(data), ...findGIFSignatures(data)]
    } else if (ext === "class") {
      type = "class"
      // Also check class files for embedded resources
      embeddedImages = [...findPNGSignatures(data), ...findGIFSignatures(data)]
    } else {
      // Check any file for embedded images
      if (data.length > 100) {
        embeddedImages = [...findPNGSignatures(data), ...findGIFSignatures(data)]
      }
    }

    return {
      name: name.split("/").pop() || name,
      path: name,
      size: data.length,
      type,
      data: base64Data,
      embeddedImages: embeddedImages.length > 0 ? embeddedImages : undefined,
    }
  }

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setIsLoading(true)
      setFiles([])
      setLog([])
      setJarName(file.name)

      addLog(`Loading JAR: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`)

      try {
        const arrayBuffer = await file.arrayBuffer()
        const zip = await JSZip.loadAsync(arrayBuffer)

        addLog(`JAR opened successfully. Found ${Object.keys(zip.files).length} entries.`)

        const extractedFiles: ExtractedFile[] = []
        const allSprites: string[] = []

        for (const [path, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue

          const data = await zipEntry.async("uint8array")
          const analyzed = await analyzeFile(path, data)
          extractedFiles.push(analyzed)

          if (analyzed.type === "image") {
            addLog(`Found image: ${analyzed.name}`)
            if (analyzed.data) allSprites.push(analyzed.data)
          }

          if (analyzed.embeddedImages && analyzed.embeddedImages.length > 0) {
            addLog(`Found ${analyzed.embeddedImages.length} embedded image(s) in: ${analyzed.name}`)
            analyzed.embeddedImages.forEach((img) => allSprites.push(img.data))
          }
        }

        setFiles(extractedFiles)
        onSpritesFound(allSprites)

        const imageCount = extractedFiles.filter((f) => f.type === "image").length
        const dataCount = extractedFiles.filter((f) => f.type === "data").length
        const embeddedCount = extractedFiles.reduce(
          (acc, f) => acc + (f.embeddedImages?.length || 0),
          0
        )

        addLog(`---`)
        addLog(`Extraction complete!`)
        addLog(`Direct images: ${imageCount}`)
        addLog(`Data files: ${dataCount}`)
        addLog(`Embedded images found: ${embeddedCount}`)
        addLog(`Total sprites: ${allSprites.length}`)
      } catch (error) {
        addLog(`ERROR: ${error instanceof Error ? error.message : "Unknown error"}`)
      } finally {
        setIsLoading(false)
      }
    },
    [onSpritesFound]
  )

  const downloadAllSprites = () => {
    const sprites = files.flatMap((f) => {
      const result: string[] = []
      if (f.data) result.push(f.data)
      if (f.embeddedImages) result.push(...f.embeddedImages.map((e) => e.data))
      return result
    })

    sprites.forEach((sprite, index) => {
      const link = document.createElement("a")
      link.href = sprite
      link.download = `sprite_${index.toString().padStart(3, "0")}.png`
      link.click()
    })
  }

  const imageFiles = files.filter((f) => f.type === "image")
  const dataFiles = files.filter((f) => f.type === "data")
  const filesWithEmbedded = files.filter((f) => f.embeddedImages && f.embeddedImages.length > 0)

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-card/50 hover:border-primary/50 transition-colors">
        <input
          type="file"
          accept=".jar"
          onChange={handleFileUpload}
          className="hidden"
          id="jar-upload"
          disabled={isLoading}
        />
        <label htmlFor="jar-upload" className="cursor-pointer block">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              {isLoading ? (
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-8 h-8 text-primary" />
              )}
            </div>
            <div>
              <p className="text-lg font-medium text-foreground">
                {isLoading ? "Analyzing JAR..." : "Upload JAR File"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Drop a J2ME .jar file here or click to browse
              </p>
            </div>
          </div>
        </label>
      </div>

      {/* Log Terminal */}
      {log.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive/70" />
              <div className="w-3 h-3 rounded-full bg-accent/70" />
              <div className="w-3 h-3 rounded-full bg-primary/70" />
            </div>
            <span className="text-xs text-muted-foreground font-mono ml-2">
              {jarName || "terminal"}
            </span>
          </div>
          <div className="p-4 font-mono text-sm max-h-64 overflow-y-auto bg-background/50">
            {log.map((line, i) => (
              <div
                key={i}
                className={`${
                  line.includes("ERROR")
                    ? "text-destructive"
                    : line.includes("Found")
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {line}
              </div>
            ))}
            {isLoading && <span className="cursor-blink" />}
          </div>
        </div>
      )}

      {/* Results */}
      {files.length > 0 && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Image className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{imageFiles.length}</p>
                  <p className="text-xs text-muted-foreground">Direct Images</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <FileArchive className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{dataFiles.length}</p>
                  <p className="text-xs text-muted-foreground">Data Files</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {files.reduce((acc, f) => acc + (f.embeddedImages?.length || 0), 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Embedded Found</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <File className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{files.length}</p>
                  <p className="text-xs text-muted-foreground">Total Files</p>
                </div>
              </div>
            </div>
          </div>

          {/* Direct Images */}
          {imageFiles.length > 0 && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-medium text-foreground">Direct Images</h3>
                <button
                  onClick={downloadAllSprites}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  <Download className="w-4 h-4" />
                  Download All
                </button>
              </div>
              <div className="p-4 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                {imageFiles.map((file, i) => (
                  <div
                    key={i}
                    className="aspect-square bg-muted rounded border border-border flex items-center justify-center overflow-hidden group relative pixel-grid"
                  >
                    {file.data && (
                      <img
                        src={file.data}
                        alt={file.name}
                        className="max-w-full max-h-full object-contain image-rendering-pixelated"
                        style={{ imageRendering: "pixelated" }}
                      />
                    )}
                    <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-xs text-foreground truncate px-1">{file.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Embedded Images */}
          {filesWithEmbedded.length > 0 && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="font-medium text-foreground">Embedded Images (extracted from binary data)</h3>
              </div>
              <div className="p-4 space-y-4">
                {filesWithEmbedded.map((file, i) => (
                  <div key={i}>
                    <p className="text-sm text-muted-foreground mb-2">
                      From: <span className="text-foreground font-mono">{file.path}</span>
                    </p>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                      {file.embeddedImages?.map((img, j) => (
                        <div
                          key={j}
                          className="aspect-square bg-muted rounded border border-border flex items-center justify-center overflow-hidden pixel-grid"
                        >
                          <img
                            src={img.data}
                            alt={`Embedded ${j}`}
                            className="max-w-full max-h-full object-contain"
                            style={{ imageRendering: "pixelated" }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No images warning */}
          {imageFiles.length === 0 && filesWithEmbedded.length === 0 && (
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-accent mt-0.5" />
              <div>
                <p className="font-medium text-foreground">No standard images found in JAR</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This game may use custom sprite formats or compressed data. 
                  Use the FreeJ2ME emulator for real-time capture to extract actual rendered sprites.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
