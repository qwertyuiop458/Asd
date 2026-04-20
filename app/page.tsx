"use client"

import { useState } from "react"
import { JarAnalyzer } from "@/components/jar-analyzer"
import { FreeJ2MEGuide } from "@/components/freej2me-guide"
import { SpriteCapture } from "@/components/sprite-capture"
import { SpriteSheet } from "@/components/sprite-sheet"
import { Terminal, Cpu, Camera, Grid3X3 } from "lucide-react"

type Tab = "analyze" | "emulator" | "capture" | "spritesheet"

export default function SpriteExtractorPage() {
  const [activeTab, setActiveTab] = useState<Tab>("analyze")
  const [capturedFrames, setCapturedFrames] = useState<string[]>([])
  const [extractedSprites, setExtractedSprites] = useState<string[]>([])

  const tabs = [
    { id: "analyze" as Tab, label: "JAR Analysis", icon: Terminal },
    { id: "emulator" as Tab, label: "FreeJ2ME Setup", icon: Cpu },
    { id: "capture" as Tab, label: "Frame Capture", icon: Camera },
    { id: "spritesheet" as Tab, label: "Sprite Sheet", icon: Grid3X3 },
  ]

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">J2ME Sprite Extractor</h1>
              <p className="text-sm text-muted-foreground">Zombie Infection - FreeJ2ME Real-time Capture</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-border bg-card/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "analyze" && (
          <JarAnalyzer onSpritesFound={setExtractedSprites} />
        )}
        {activeTab === "emulator" && <FreeJ2MEGuide />}
        {activeTab === "capture" && (
          <SpriteCapture 
            onFramesCaptured={setCapturedFrames} 
            capturedFrames={capturedFrames}
          />
        )}
        {activeTab === "spritesheet" && (
          <SpriteSheet 
            frames={capturedFrames} 
            extractedSprites={extractedSprites}
          />
        )}
      </div>
    </main>
  )
}
