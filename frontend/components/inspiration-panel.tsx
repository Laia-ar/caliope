"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Edit,
  Plus,
  History,
  Loader2,
  HelpCircle,
  Crosshair,
  X,
} from "lucide-react";
import { CreatePromptModal } from "./create-prompt-modal";
import { EditPromptForm } from "./edit-prompt-form";
import Image from "next/image";
import { loadPrompts, savePrompt, getPrompt, type Prompt } from "@/lib/prompts";
import { buildBackendUrl } from "@/lib/backend";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TimeAgo } from "@/components/time-ago";
import { QuestionCard } from "./question-card";

interface Question {
  id: string;
  text: string;
}

interface QueryHistoryItem {
  id: string;
  query: string;
  prompt_name: string;
  model_used: string;
  created_at: string;
  document_id: string | null;
  focused_passage?: string | null;
  questions?: Question[];
}

interface InspirationPanelProps {
  documentContent?: string;
  documentId?: string;
  initialPromptId?: string | null;
  onQuestionsGenerated?: (questions: Question[]) => void;
  focusedPassage?: string | null;
  onClearFocus?: () => void;
}

export function InspirationPanel({
  documentContent = "",
  documentId,
  initialPromptId,
  onQuestionsGenerated,
  focusedPassage,
  onClearFocus,
}: InspirationPanelProps) {
  const router = useRouter();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<string>("");
  const MODEL_OPTIONS = [
    { value: "google/gemini-2.0-flash-001", label: "Google Gemini" },
    { value: "mistralai/mistral-nemo", label: "Mistral Nemo" },
    { value: "deepseek/deepseek-chat-v3-0324", label: "DeepSeek" },
    { value: "qwen/qwen-2.5-7b-instruct", label: "Qwen 2.5 7B" },
    { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
    { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  ] as const;

  const [selectedModel, setSelectedModel] = useState<
    (typeof MODEL_OPTIONS)[number]["value"]
  >(MODEL_OPTIONS[0].value);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(() => !initialPromptId);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [isPromptHelpModalOpen, setIsPromptHelpModalOpen] = useState(false);
  const [selectKey, setSelectKey] = useState(0);

  const updatePromptInState = (updatedPrompt: Prompt) => {
    setPrompts((prev) =>
      prev.map((prompt) =>
        prompt.id === updatedPrompt.id
          ? { ...prompt, ...updatedPrompt }
          : prompt
      )
    );
  };

  const loadPromptsData = async () => {
    const data = await loadPrompts();
    setPrompts(data);
  };

  useEffect(() => {
    loadPromptsData();
  }, []);

  useEffect(() => {
    if (!selectedPrompt) {
      if (initialPromptId) {
        return;
      }
      setIsCollapsed(true);
    }
  }, [initialPromptId, selectedPrompt]);

  useEffect(() => {
    if (initialPromptId && prompts.length > 0) {
      const promptExists = prompts.find((p) => p.id === initialPromptId);
      if (promptExists) {
        setSelectedPrompt(initialPromptId);
        setIsCollapsed(false);
      }
    }
  }, [initialPromptId, prompts]);

  const handleGenerateQuestions = async () => {
    if (!selectedPrompt || isLoading) {
      return;
    }

    const promptIdNumber = Number(selectedPrompt);

    if (!Number.isFinite(promptIdNumber)) {
      toast.error("El prompt seleccionado no es válido");
      return;
    }

    const trimmedContent = documentContent.trim();

    if (!trimmedContent) {
      toast.error(
        "Necesitás agregar contenido al texto antes de generar preguntas"
      );
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Generando preguntas...");

    const payload = {
      text: trimmedContent,
      customprompt: promptIdNumber,
      llm_model_name: selectedModel,
      document_id: documentId ?? undefined,
      focused_passage: focusedPassage ?? undefined,
    };

    try {
      const response = await fetch(buildBackendUrl("/api/query"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const message =
          typeof data?.error === "string"
            ? data.error
            : "No se pudieron generar preguntas";
        throw new Error(message);
      }

      const message = typeof data?.message === "string" ? data.message : "";
      const generatedQuestions = message
        .split(/\r?\n/)
        .map((line: string) => line.trim())
        .filter(Boolean)
        .map((text: string) => ({
          id: crypto.randomUUID(),
          text,
        }));

      if (generatedQuestions.length === 0) {
        throw new Error("La respuesta no incluyó preguntas");
      }

      setQuestions(generatedQuestions);
      onQuestionsGenerated?.(generatedQuestions);
    } catch (error) {
      console.error("Error generating questions:", error);
      const message =
        error instanceof Error
          ? error.message
          : "No se pudieron generar preguntas";
      toast.error(message);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleEditPrompt = async () => {
    const prompt = prompts.find((p) => p.id === selectedPrompt);
    if (!prompt) {
      return;
    }

    try {
      const detailedPrompt = prompt.instructions
        ? prompt
        : await getPrompt(prompt.id);
      updatePromptInState(detailedPrompt);
      setEditingPrompt(detailedPrompt);
      setIsEditModalOpen(true);
    } catch (error) {
      console.error("Error loading prompt for editing:", error);
    }
  };

  const handleSavePrompt = async (promptData: Partial<Prompt>) => {
    if (editingPrompt) {
      const success = await savePrompt(editingPrompt.id, promptData);
      if (success) {
        try {
          const refreshed = await getPrompt(editingPrompt.id);
          updatePromptInState(refreshed);
        } catch (error) {
          console.error("Error refreshing prompt after save:", error);
        }
        await loadPromptsData();
        setIsEditModalOpen(false);
        setEditingPrompt(null);
      }
    }
  };

  const handlePromptChange = (value: string) => {
    if (value === "create-new") {
      setIsCreateModalOpen(true);
    } else {
      setSelectedPrompt(value);
      setIsCollapsed(false);
    }
  };

  const handleCreateSuccess = (newPromptId: string) => {
    loadPromptsData().then(() => {
      setSelectedPrompt(newPromptId);
      setSelectKey((prev) => prev + 1);
    });
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const url = documentId
        ? `/api/queries/history?document_id=${documentId}`
        : "/api/queries/history";

      const response = await fetch(buildBackendUrl(url), {
        credentials: "include",
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        const message =
          typeof errorPayload?.error === "string"
            ? errorPayload.error
            : "No se pudo cargar el historial";
        throw new Error(message);
      }

      const data = await response.json();
      const rawHistory = Array.isArray(data?.queries)
        ? data.queries
        : Array.isArray(data)
        ? data
        : [];

      const historyWithQuestions = rawHistory.map((item: any) => {
        const responseText =
          typeof item?.response_text === "string" ? item.response_text : "";
        const questionItems = responseText
          .split(/\r?\n/)
          .map((line: string) => line.trim())
          .filter(Boolean)
          .map((text: string) => ({
            id: `${item?.id ?? crypto.randomUUID()}-${crypto.randomUUID()}`,
            text,
          }));

        return {
          id: String(item?.id ?? crypto.randomUUID()),
          query: item?.query_text ?? responseText,
          prompt_name: item?.prompt_name ?? "Prompt personalizado",
          model_used:
            item?.llm_model_name ?? item?.model_used ?? "Modelo desconocido",
          created_at: item?.created_at ?? new Date().toISOString(),
          document_id: item?.document_id ? String(item.document_id) : null,
          focused_passage: item?.focused_passage ?? null,
          questions: questionItems,
        };
      });

      setHistory(historyWithQuestions);
    } catch (error) {
      console.error("Error loading history:", error);
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo cargar el historial";
      toast.error(message);
      setHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleToggleHistory = () => {
    if (!showHistory) {
      loadHistory();
    }
    setShowHistory(!showHistory);
  };

  const selectedPromptData = prompts.find((p) => p.id === selectedPrompt);

  if (isCollapsed) {
    return (
      <div
        className="transition-all duration-500 ease-in-out rounded-lg overflow-hidden"
        style={{
          background: `#f3f4f6`,
          backgroundImage: `
            radial-gradient(25% 65% at var(--8-x-position) 25%,rgba(24, 98, 162, 0.4) -41%, transparent),
            radial-gradient(25% 65% at var(--9-x-position) 25%, rgba(180, 15, 127, 0.4) -42%, transparent),
            radial-gradient(40% 65% at var(--10-x-position) 25%, rgba(198, 188, 221, 1) -43%, transparent),
            radial-gradient(25% 65% at var(--11-x-position) 25%, rgba(128, 73, 142, 0.6) 0%, transparent)`,
        }}
      >
        <div className="px-6 py-3 flex items-center justify-between gap-4 transform transition-all duration-500 ease-in-out">
          {/* Left Section - Controls */}
          <div className="flex items-center gap-3 flex-1">
            <Select key={selectKey} value={selectedPrompt} onValueChange={handlePromptChange}>
              <SelectTrigger className="w-48 bg-white/80 font-sans h-9 transition-all duration-300 ease-in-out">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Image
                    src="/icons/prompt-icon.svg"
                    alt="Prompt"
                    width={16}
                    height={16}
                    className="w-4 h-4 flex-shrink-0"
                  />
                  <div className="truncate">
                    <SelectValue placeholder="Seleccionar prompt" />
                  </div>
                </div>
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                {prompts.map((prompt) => (
                  <SelectItem key={prompt.id} value={prompt.id}>
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate max-w-[200px]">
                        {prompt.name}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                        {prompt.isPublic ? "Público" : "Privado"}
                      </span>
                    </div>
                  </SelectItem>
                ))}
                <div className="px-2 py-2 border-t border-gray-200 mt-1">
                  <div className="flex items-center justify-between">
                    <button
                      className="text-sm text-blue-600 hover:text-blue-800 font-sans underline decoration-dotted underline-offset-4"
                      onClick={() => {
                        router.push("/prompts");
                      }}
                    >
                      Ver más
                    </button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="font-sans text-sm btn-radius"
                      onClick={() => setIsCreateModalOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Crear prompt
                    </Button>
                  </div>
                </div>
              </SelectContent>
            </Select>

            {selectedPrompt &&
              selectedPromptData &&
              !selectedPromptData.isPublic && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEditPrompt}
                  className="p-2 h-9 w-9 bg-white/80 hover:bg-white/90 rounded-lg"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              )}

            <Select
              value={selectedModel}
              onValueChange={(value) =>
                setSelectedModel(value as (typeof MODEL_OPTIONS)[number]["value"])
              }
            >
              <SelectTrigger className="w-auto border-none bg-transparent p-0 h-auto shadow-none hover:bg-transparent focus:ring-0">
                <SelectValue placeholder="Seleccionar modelo" />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Right Section - Action Buttons */}
          <div className="flex items-center gap-2">
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      onClick={handleGenerateQuestions}
                      disabled={!selectedPrompt || isLoading}
                      variant="primary"
                      className="font-sans text-sm font-normal btn-radius px-4 py-2 h-9"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {loadingMessage}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          {questions.length > 0
                            ? "Generar más preguntas"
                            : "Preguntar"}
                        </>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!selectedPrompt && (
                  <TooltipContent>
                    <p>Primero selecciona un prompt para preguntar</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!selectedPrompt) {
                  return;
                }
                setIsCollapsed(false);
              }}
              disabled={!selectedPrompt}
              className="p-2 h-9 w-9 hover:bg-white/20 rounded-lg"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 22 22"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M13.3125 9.65689C13.0448 9.92459 12.6109 9.92459 12.3432 9.65689C12.0755 9.38919 12.0755 8.95527 12.3432 8.68757L18.741 2.28972C19.0087 2.02203 19.4427 2.02203 19.7104 2.28972C19.9781 2.55742 19.9781 2.99134 19.7104 3.25904L13.3125 9.65689Z"
                  fill="#404040"
                />
                <path
                  d="M19.9111 8.25861C19.9111 8.63719 19.6042 8.94409 19.2256 8.94409C18.8471 8.94409 18.5402 8.63719 18.5402 8.25861L18.5402 3.46022L13.7418 3.46022C13.3632 3.46022 13.0563 3.15332 13.0563 2.77474C13.0563 2.39615 13.3632 2.08925 13.7418 2.08925L19.2256 2.08925C19.6042 2.08925 19.9111 2.39615 19.9111 2.77474L19.9111 8.25861Z"
                  fill="#404040"
                />
                <path
                  d="M3.2588 19.7106C2.9911 19.9783 2.55718 19.9783 2.28948 19.7106C2.02178 19.4429 2.02178 19.009 2.28948 18.7413L8.68733 12.3434C8.95503 12.0757 9.38895 12.0757 9.65665 12.3434C9.92435 12.6111 9.92435 13.0451 9.65665 13.3128L3.2588 19.7106Z"
                  fill="#404040"
                />
                <path
                  d="M3.46047 13.742L3.46047 18.5404L8.25885 18.5404C8.63743 18.5404 8.94434 18.8473 8.94434 19.2259C8.94434 19.6045 8.63743 19.9114 8.25885 19.9114L2.77498 19.9114C2.3964 19.9114 2.0895 19.6045 2.0895 19.2259L2.0895 13.742C2.0895 13.3634 2.3964 13.0565 2.77498 13.0565C3.15356 13.0565 3.46047 13.3634 3.46047 13.742Z"
                  fill="#404040"
                />
              </svg>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="transition-all duration-500 ease-in-out rounded-lg overflow-hidden"
      style={{
        background: `#f3f4f6`,
        backgroundImage: `
            radial-gradient(25% 45% at var(--8-x-position) -5%,rgba(24, 98, 162, 0.4) -41%, transparent),
            radial-gradient(25% 45% at var(--9-x-position) -5%, rgba(180, 15, 127, 0.4) -42%, transparent),
            radial-gradient(40% 45% at var(--10-x-position) -5%, rgba(198, 188, 221, 1) -43%, transparent),
            radial-gradient(25% 45% at var(--11-x-position) -5%, rgba(128, 73, 142, 0.6) 0%, transparent)`,
      }}
    >
      <div className="px-6 py-4 transform transition-all duration-500 ease-in-out">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Select key={selectKey} value={selectedPrompt} onValueChange={handlePromptChange}>
              <SelectTrigger className="w-64 bg-white/80 font-sans h-9 transition-all duration-300 ease-in-out">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Image
                    src="/icons/prompt-icon.svg"
                    alt="Prompt"
                    width={16}
                    height={16}
                    className="w-4 h-4 flex-shrink-0"
                  />
                  <div className="truncate">
                    <SelectValue placeholder="Seleccionar prompt" />
                  </div>
                </div>
              </SelectTrigger>
              <SelectContent  className="max-h-72 overflow-y-auto">
                {prompts.map((prompt) => (
                  <SelectItem key={prompt.id} value={prompt.id}>
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate max-w-[200px]">
                        {prompt.name}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                        {prompt.isPublic ? "Público" : "Privado"}
                      </span>
                    </div>
                  </SelectItem>
                ))}
                <div className="px-2 py-2 border-t border-gray-200 mt-1">
                  <div className="flex items-center justify-between">
                    <button
                      className="text-sm text-[#1862A2] hover:text-blue-800 font-sans underline decoration-dotted underline-offset-4"
                      onClick={() => {
                        router.push("/prompts");
                      }}
                    >
                      Ver más
                    </button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="font-sans text-sm btn-radius"
                      onClick={() => setIsCreateModalOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Crear prompt
                    </Button>
                  </div>
                </div>
              </SelectContent>
            </Select>

            {selectedPrompt &&
              selectedPromptData &&
              !selectedPromptData.isPublic && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEditPrompt}
                  className="p-2 h-8 w-8 bg-white/80 hover:bg-white/90 rounded-lg"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              )}

            <Select
              value={selectedModel}
              onValueChange={(value) =>
                setSelectedModel(value as (typeof MODEL_OPTIONS)[number]["value"])
              }
            >
              <SelectTrigger className="w-auto border-none bg-transparent p-0 h-auto shadow-none hover:bg-transparent font-mono focus:ring-0">
                <SelectValue placeholder="Seleccionar modelo" />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            {selectedPrompt && questions.length > 0 && (
              <Button
                onClick={handleGenerateQuestions}
                disabled={isLoading}
                variant="primary"
                className="font-sans text-sm font-normal btn-radius px-4 py-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {loadingMessage}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generar más preguntas
                  </>
                )}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(true)}
              className="p-2 h-8 w-8 hover:bg-white/20 rounded-lg"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 22 22"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18.7412 2.28964C19.0089 2.02194 19.4428 2.02194 19.7105 2.28964C19.9782 2.55734 19.9782 2.99126 19.7105 3.25896L13.3127 9.65681C13.045 9.92451 12.611 9.92451 12.3434 9.65681C12.0757 9.38911 12.0757 8.95519 12.3434 8.68749L18.7412 2.28964Z"
                  fill="#404040"
                />
                <path
                  d="M12.1426 3.68793C12.1426 3.30934 12.4495 3.00244 12.8281 3.00244C13.2066 3.00244 13.5135 3.30934 13.5135 3.68793V8.48631H18.3119C18.6905 8.48631 18.9974 8.79321 18.9974 9.1718C18.9974 9.55038 18.6905 9.85728 18.3119 9.85728H12.8281C12.4495 9.85728 12.1426 9.55038 12.1426 9.1718V3.68793Z"
                  fill="#404040"
                />
                <path
                  d="M8.68749 12.3434C8.95519 12.0757 9.38911 12.0757 9.65681 12.3434C9.92451 12.611 9.92451 13.045 9.65681 13.3127L3.25896 19.7105C2.99126 19.9782 2.55734 19.9782 2.28964 19.7105C2.02194 19.4428 2.02194 19.0089 2.28964 18.7412L8.68749 12.3434Z"
                  fill="#404040"
                />
                <path
                  d="M8.48631 18.3119V13.5135H3.68793C3.30934 13.5135 3.00244 13.2066 3.00244 12.8281C3.00244 12.4495 3.30934 12.1426 3.68793 12.1426H9.1718C9.55038 12.1426 9.85728 12.4495 9.85728 12.8281V18.3119C9.85728 18.6905 9.55038 18.9974 9.1718 18.9974C8.79321 18.9974 8.48631 18.6905 8.48631 18.3119Z"
                  fill="#404040"
                />
              </svg>
            </Button>
          </div>
        </div>

        {focusedPassage && (
          <div className="mt-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-3 py-1.5 text-sm font-sans">
              <Crosshair className="w-3.5 h-3.5 text-amber-600" />
              <span className="truncate max-w-[300px]">
                Foco: &ldquo;{focusedPassage.length > 60 ? focusedPassage.slice(0, 60) + "…" : focusedPassage}&rdquo;
              </span>
              <button
                onClick={onClearFocus}
                className="ml-1 p-0.5 hover:bg-amber-100 rounded-full transition-colors"
                title="Quitar foco"
              >
                <X className="w-3.5 h-3.5 text-amber-600" />
              </button>
            </div>
          </div>
        )}

        {selectedPrompt && questions.length === 0 && !isLoading && (
          <div className="text-center py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Button
              onClick={handleGenerateQuestions}
              disabled={isLoading}
              variant="primary"
              className="font-sans text-sm font-normal btn-radius px-6 py-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {loadingMessage}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Preguntar
                </>
              )}
            </Button>
          </div>
        )}

        {selectedPrompt && questions.length === 0 && isLoading && (
          <div className="text-center py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-center text-gray-600">
              <Loader2 className="w-5 h-5 mr-3 animate-spin" />
              <span className="font-sans text-sm">{loadingMessage}</span>
            </div>
          </div>
        )}

        {questions.length > 0 && !isLoading && (
          <div className="mt-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {showHistory ? (
              <div className="space-y-8">
                <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
                  <h3 className="font-sans text-lg font-medium text-gray-800">
                    Historial de preguntas
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleHistory}
                    className="font-sans text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cerrar historial de preguntas
                  </Button>
                </div>

                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="flex items-center text-gray-600">
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      <span className="font-sans text-sm">
                        Cargando historial...
                      </span>
                    </div>
                  </div>
                ) : history.length > 0 ? (
                  <div className="space-y-8">
                    {history.map((item, historyIndex) => (
                      <div
                        key={item.id}
                        className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                        style={{
                          animationDelay: `${historyIndex * 100}ms`,
                          animationFillMode: "both",
                        }}
                      >
                        {/* Three question cards in a row */}
                        <div className="grid grid-cols-3 gap-4">
                          {item.questions?.map((question, index) => (
                            <QuestionCard
                              key={question.id}
                              question={question}
                              index={index}
                              showHoverEffects={true}
                            />
                          ))}
                        </div>

                        {/* Metadata row */}
                        <div className="flex items-center gap-4 text-sm px-4 py-2 text-foreground font-mono mt-12">
                          <span>
                            <TimeAgo value={item.created_at} />
                          </span>
                          |<span>{item.prompt_name}</span> |
                          <span>{item.model_used}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="font-sans text-gray-600">
                      No hay preguntas en el historial
                    </p>
                    <p className="font-sans text-sm text-gray-500 mt-1">
                      Las consultas aparecerán aquí después de generar preguntas
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  {questions.slice(0, 3).map((question, index) => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      index={index}
                      showHoverEffects={true}
                    />
                  ))}
                </div>

                <div
                  className="text-center mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500"
                  style={{ animationDelay: "800ms", animationFillMode: "both" }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleHistory}
                    className="font-sans text-sm text-gray-600 hover:text-gray-800"
                  >
                    <History className="w-4 h-4 mr-1" />
                    Ver historial de preguntas
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {!selectedPrompt && (
          <div className="text-center py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="font-sans text-muted-foreground mb-3">
              Para empezar, seleccioná un prompt.
            </p>
            <button
              onClick={() => setIsPromptHelpModalOpen(true)}
              className="inline-flex items-center text-sm hover:text-blue-800 underline decoration-dotted underline-offset-4 cursor-pointer font-mono text-primary"
            >
              <HelpCircle className="w-4 h-4 mr-1" />
              ¿Qué es un prompt para Calíope?
            </button>
          </div>
        )}
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Editar prompt</DialogTitle>
          </DialogHeader>
          {editingPrompt && (
            <EditPromptForm
              prompt={editingPrompt}
              onSave={handleSavePrompt}
              onCancel={() => setIsEditModalOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <CreatePromptModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      <Dialog
        open={isPromptHelpModalOpen}
        onOpenChange={setIsPromptHelpModalOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-sans">
              ¿Qué es un prompt para Calíope?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="font-sans text-sm leading-relaxed text-gray-700">
              Un prompt contiene instrucciones que guían la generación de
              preguntas. Define el contexto, el estilo y el tipo de preguntas
              que propone Calíope basándose en el contenido de tu texto.
            </p>
          </div>
        <div className="flex justify-end">
          <Button
            onClick={() => setIsPromptHelpModalOpen(false)}
            variant="primary"
            className="font-sans text-sm btn-radius py-2 px-4"
          >
            Entendido
          </Button>
        </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
