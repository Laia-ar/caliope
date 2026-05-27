"use client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Link, X } from "lucide-react"

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="flex justify-between items-center">
          <DialogTitle className="text-xl font-semibold text-gray-900">Ayuda - Calíope</DialogTitle>
          <Button variant="ghost" size="sm" className="p-0 h-6 w-6" onClick={onClose}>
            
          </Button>
        </DialogHeader>

        <div className="space-y-6 text-gray-700">
          <section>
            <h3 className="text-lg font-medium text-gray-900 mb-3">¿Qué es Calíope?</h3>
            <p className="text-sm leading-relaxed">
              Calíope es una musa digital que acompaña tu escritura sin reemplazarte. Diseñada por LAIA, no responde a
              órdenes ni escribe por vos: lee tu texto y te inspira con preguntas que abren caminos creativos. Su
              espíritu es artesanal y humano: invita a imaginar, explorar y seguir escribiendo, siempre con vos en el
              centro del proceso.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-medium text-gray-900 mb-3">¿Cómo usar Calíope?</h3>
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-medium text-gray-800">1. Elegí un prompt.</h4>
                <p className="text-gray-600 ml-4">Los prompts contienen las indicaciones del rol que debe asumir Calíope para formular preguntas, según el tipo de texto que estés escribiendo.</p>
                <p>Podés crear tu prompt o elegir uno de la <Link  href="/prompts">Biblioteca de prompts</Link>.</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-800">2. Seleccioná un modelo de lenguaje</h4>
                <p className="text-gray-600 ml-4">
                  (ChatGPT, Gemini, DeepsSeek, Llama, etc.)
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-800">3. Empezá a escribir.</h4>
                <p className="text-gray-600 ml-4">
                  Elige un tipo de inspiración desde el panel lateral: preguntas inesperadas, desarrollo de personajes,
                  etc.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-800">4. Hacé clic en “Preguntar”</h4>
                <p className="text-gray-600 ml-4">
                  Cuando necesités inspiración.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-800">5. Probá distintas configuraciones.</h4>
                <p className="text-gray-600 ml-4">
                  Si las tres preguntas no te inspiran, cliqueá nuevamente o cambiá el modelo de lenguaje y el prompt.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-800">6. Guardá tus avances</h4>
                <p className="text-gray-600 ml-4">
                  Para no perderlos.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Tipos de prompts</h3>
            <div className="space-y-2 text-sm">
              <p>
                <strong>Preguntas inesperadas:</strong> Explora nuevas direcciones narrativas
              </p>
              <p>
                <strong>Desarrollo de personajes:</strong> Profundiza en la psicología de tus personajes
              </p>
              <p>
                <strong>Construcción de mundos:</strong> Expande el universo de tu historia
              </p>
              <p>
                <strong>Conflictos y tensión:</strong> Intensifica el drama de tu narrativa
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Consejos</h3>
            <ul className="space-y-1 text-sm text-gray-600 list-disc list-inside">
              <li>Escribe al menos un párrafo antes de generar inspiración</li>
              <li>Experimenta con diferentes tipos de prompts</li>
              <li>Las preguntas están diseñadas para abrir posibilidades, no para limitarte</li>
              <li>Guarda tu trabajo regularmente usando Ctrl+S</li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
