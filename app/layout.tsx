import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" })
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "J2ME Sprite Extractor - Zombie Infection",
  description: "Tool for extracting sprites from J2ME games using FreeJ2ME emulator",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className="bg-background">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
