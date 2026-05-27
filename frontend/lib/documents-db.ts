export interface Document {
  id: number
  title: string
  creator_name: string
  updated_at: string
  tags: string[]
  content: string
  content_format: string
}

const STORAGE_KEY = "caliope_documents"

// Initial documents to populate localStorage
const initialDocuments: Document[] = [
  {
    id: 1,
    title: "Mi primer texto",
    creator_name: "Usuario Demo",
    updated_at: "2025-01-09T10:21:00Z",
    tags: ["Personal"],
    content: "# Mi primer texto\n\nEste es el contenido de mi primer texto...",
    content_format: "markdown",
  },
  {
    id: 2,
    title: "Ideas para novela",
    creator_name: "Usuario Demo",
    updated_at: "2025-01-08T15:30:00Z",
    tags: ["Ficción"],
    content: "# Ideas para novela\n\n## Personajes\n- Protagonista: María\n- Antagonista: El tiempo",
    content_format: "markdown",
  },
  {
    id: 3,
    title: "Notas de reunión",
    creator_name: "Usuario Demo",
    updated_at: "2025-01-07T09:15:00Z",
    tags: ["Trabajo"],
    content: "# Notas de reunión\n\n## Agenda\n1. Revisión de proyecto\n2. Próximos pasos",
    content_format: "markdown",
  },
]

// Initialize localStorage with default documents if empty
function initializeStorage(): void {
  if (typeof window === "undefined") return // Server-side check

  const existing = localStorage.getItem(STORAGE_KEY)
  if (!existing) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDocuments))
  }
}

// Get all documents from localStorage
export function getAllDocuments(): Document[] {
  if (typeof window === "undefined") return initialDocuments // Server-side fallback

  initializeStorage()
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : initialDocuments
}

// Get document by ID
export function getDocumentById(id: number): Document | null {
  const documents = getAllDocuments()
  return documents.find((doc) => doc.id === id) || null
}

// Save document (create or update)
export function saveDocument(document: Partial<Document> & { title: string; content: string }): Document {
  const documents = getAllDocuments()

  if (document.id) {
    // Update existing document
    const index = documents.findIndex((doc) => doc.id === document.id)
    if (index !== -1) {
      documents[index] = {
        ...documents[index],
        ...document,
        updated_at: new Date().toISOString(),
      }
      saveAllDocuments(documents)
      return documents[index]
    }
  }

  // Create new document
  const newId = Math.max(...documents.map((d) => d.id), 0) + 1
  const newDocument: Document = {
    id: newId,
    title: document.title,
    creator_name: "Usuario Demo",
    updated_at: new Date().toISOString(),
    tags: document.tags || ["Sin categoría"],
    content: document.content,
    content_format: document.content_format || "html",
  }

  documents.push(newDocument)
  saveAllDocuments(documents)
  return newDocument
}

// Delete document by ID
export function deleteDocument(id: number): boolean {
  const documents = getAllDocuments()
  const index = documents.findIndex((doc) => doc.id === id)

  if (index !== -1) {
    documents.splice(index, 1)
    saveAllDocuments(documents)
    return true
  }

  return false
}

// Save all documents to localStorage
function saveAllDocuments(documents: Document[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(documents))
}
