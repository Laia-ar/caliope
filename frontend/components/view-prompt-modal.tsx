"use client";

import { MarkdownRenderedView } from "@/components/markdown-rendered-view";
import { Button } from "@/components/ui/button";
import type { Prompt } from "@/lib/prompts";

interface ViewPromptModalProps {
  prompt: Prompt;
  onClose: () => void;
}

export function ViewPromptModal({ prompt, onClose }: ViewPromptModalProps) {
  return (
    <div className="space-y-6 flex flex-col min-h-0">
      <div className="space-y-2 flex-1 min-h-0">
        <div className="p-3 bg-gray-50 rounded-md border max-h-[60vh] overflow-y-auto">
          <MarkdownRenderedView
            content={prompt.instructions}
            emptyPlaceholder={
              <p className="text-gray-500">Sin instrucciones</p>
            }
          />
        </div>
      </div>

      <div className="flex justify-end flex-shrink-0">
        <Button type="button" variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
