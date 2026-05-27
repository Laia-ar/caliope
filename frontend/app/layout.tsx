import type React from "react"
import type { Metadata } from "next"
import { Fira_Sans, Fira_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"

const firaSans = Fira_Sans({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fira-sans",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
})

const firaMono = Fira_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fira-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Consolas", "Liberation Mono", "Menlo", "monospace"],
})

export const metadata: Metadata = {
  title: "Calíope - Tu musa digital",
  description: "Una musa digital que acompaña tu escritura sin reemplazarte",
  generator: "v0.app",
  icons: {
    icon: [
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/favicon/apple-touch-icon.png",
    shortcut: "/favicon/favicon.ico",
  },
  manifest: "/favicon/site.webmanifest",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${firaSans.variable} ${firaMono.variable} antialiased`}>
      <body>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
