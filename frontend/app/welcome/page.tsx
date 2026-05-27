"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PenTool } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function WelcomeScreen() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isHowToUseModalOpen, setIsHowToUseModalOpen] = useState(false)

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed)
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#FAFAFA" }}>
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={handleSidebarToggle} />

      <div className="flex-1 p-4">
        <div className="h-full rounded-lg shadow-lg animated-gradient flex flex-col items-center justify-center px-6 text-center">
          {/* Logo */}
          <div className="mb-12"></div>

          {/* Title */}
          <h1 className="text-5xl font-semibold mb-8 text-gray-900  relative">
            Calíope
            <sup className="ml-2 text-xs font-normal bg-blue-200 text-primary px-2 py-1 rounded-md align-super">
              BETA
            </sup>
          </h1>

          {/* Description */}
          <div className="max-w-2xl mb-12 space-y-4 text-gray-700 text-lg leading-relaxed  font-normal">
            <p>Calíope es una musa digital que lee tu texto y, si se lo pedís, te hace preguntas para inspirarte.
               En lugar de redactar por vos, abre posibles caminos creativos para que sigas escribiendo, a tu manera.
            </p>
          </div>

          {/* CTA Button */}
        <Link href="/write">
          <Button
            size="lg"
            variant="primary"
            className="mb-6 px-8 py-3 text-sm btn-radius"
          >
            <PenTool className="w-5 h-5 mr-2" />
            Empezar a escribir
            </Button>
          </Link>

          {/* How it works link */}
          <button
            onClick={() => setIsHowToUseModalOpen(true)}
            className="text-gray-600 hover:text-gray-900 underline transition-colors  text-sm cursor-pointer">
            ¿Cómo usar Calíope?
          </button>

          <Dialog open={isHowToUseModalOpen} onOpenChange={setIsHowToUseModalOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-gray-900 ">¿Cómo usar Calíope?</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-gray-700 ">
                <div className="space-y-3">
                  <p>
                    <strong>1.</strong> Elegí un prompt. Los prompts contienen las indicaciones del rol que debe asumir
                    Calíope para formular preguntas, según el tipo de texto que estés escribiendo. Podés crear tu prompt o
                    elegir uno de la{" "}
                    <Link href="/prompts" className="text-blue-600 hover:text-blue-800 underline font-medium">
                      Biblioteca de prompts
                    </Link>
                    .
                  </p>

                  <p>
                    <strong>2.</strong> Seleccioná un modelo de lenguaje (ChatGPT, Gemini, DeepsSeek, Llama, etc.).
                  </p>

                  <p>
                    <strong>3.</strong> Empezá a escribir.
                  </p>

                  <p>
                    <strong>4.</strong> Hacé clic en "Preguntar" cuando necesités inspiración.
                  </p>

                  <p>
                    <strong>5.</strong> Probá distintas configuraciones. Si las tres preguntas no te inspiran, cliqueá
                    nuevamente o cambiá el modelo de lenguaje y el prompt.
                  </p>

                  <p>
                    <strong>6.</strong> Guardá tus avances para no perderlos.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
