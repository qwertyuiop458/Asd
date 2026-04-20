"use client"

import { useState, useEffect } from "react"
import { Terminal, Loader2, CheckCircle, XCircle, Image, Download, ZoomIn } from "lucide-react"

interface ExtractionResult {
  success?: boolean
  error?: string
  directImages?: number
  embeddedImages?: number
  totalFiles?: number
  extractedFiles?: string[]
  logs?: string[]
}

export default function SpriteExtractorPage() {
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const runExtraction = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/extract')
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({ error: String(err) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runExtraction()
  }, [])

  const downloadAll = () => {
    if (!result?.extractedFiles) return
    result.extractedFiles.forEach((file, i) => {
      setTimeout(() => {
        const a = document.createElement('a')
        a.href = file
        a.download = file.split('/').pop() || `sprite_${i}.png`
        a.click()
      }, i * 100)
    })
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Terminal className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Zombie Infection Sprite Extractor</h1>
                <p className="text-sm text-zinc-400">Real-time extraction from J2ME JAR</p>
              </div>
            </div>
            <button
              onClick={runExtraction}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
              {loading ? 'Extracting...' : 'Re-Extract'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Status */}
        {loading && (
          <div className="mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
            <span>Extracting sprites from Zombie Infection JAR...</span>
          </div>
        )}

        {result?.error && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-900 rounded-lg flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-200">{result.error}</span>
          </div>
        )}

        {result?.success && (
          <>
            {/* Stats */}
            <div className="mb-6 grid grid-cols-3 gap-4">
              <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
                <div className="text-3xl font-bold text-emerald-400">{result.totalFiles}</div>
                <div className="text-sm text-zinc-400">Files in JAR</div>
              </div>
              <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
                <div className="text-3xl font-bold text-blue-400">{result.directImages}</div>
                <div className="text-sm text-zinc-400">Direct Images</div>
              </div>
              <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
                <div className="text-3xl font-bold text-purple-400">{result.embeddedImages}</div>
                <div className="text-sm text-zinc-400">Embedded Images</div>
              </div>
            </div>

            {/* Extracted Images */}
            {result.extractedFiles && result.extractedFiles.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Image className="w-5 h-5 text-emerald-400" />
                    Extracted Sprites ({result.extractedFiles.length})
                  </h2>
                  <button
                    onClick={downloadAll}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download All
                  </button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                  {result.extractedFiles.map((file, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(file)}
                      className="aspect-square bg-zinc-900 border border-zinc-800 rounded-lg p-2 hover:border-emerald-500 transition-colors group relative"
                    >
                      <img
                        src={file}
                        alt={`Sprite ${i}`}
                        className="w-full h-full object-contain image-rendering-pixelated"
                        style={{ imageRendering: 'pixelated' }}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn className="w-4 h-4" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Logs */}
            {result.logs && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
                <div className="p-3 border-b border-zinc-800 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-zinc-400" />
                  <span className="font-medium">Extraction Log</span>
                </div>
                <pre className="p-4 text-xs text-zinc-400 font-mono overflow-x-auto max-h-96 overflow-y-auto">
                  {result.logs.join('\n')}
                </pre>
              </div>
            )}
          </>
        )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 max-w-2xl">
            <img
              src={selectedImage}
              alt="Selected sprite"
              className="max-w-full max-h-[70vh] object-contain mx-auto"
              style={{ imageRendering: 'pixelated' }}
            />
            <div className="mt-3 text-center">
              <p className="text-sm text-zinc-400 mb-2">{selectedImage.split('/').pop()}</p>
              <a
                href={selectedImage}
                download
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
