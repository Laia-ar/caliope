import { Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { isMarkdown } from "@/lib/utils";

interface Question {
  id: string;
  text: string;
}

interface QuestionCardProps {
  question: Question;
  index?: number;
  showHoverEffects?: boolean;
  animationDelay?: number;
}

export function QuestionCard({
  question,
  index = 0,
  showHoverEffects = true,
  animationDelay,
}: QuestionCardProps) {
  const delay = animationDelay ?? index * 200;

  return (
    <div
      key={question.id}
      className={`rounded-lg p-4 shadow-sm border border-gray-200 flex flex-col items-start animate-in fade-in slide-in-from-bottom-4 bg-transparent transition-all duration-300 ease-in-out ${
        showHoverEffects ? "hover:shadow-md hover:border-gray-300" : ""
      }`}
      style={{
        animationDelay: `${delay}ms`,
        animationFillMode: "both",
      }}
    >
      <Sparkles className="w-5 h-5 text-gray-600 mb-3 flex-shrink-0" />
      {isMarkdown(question.text) ? (
        <ReactMarkdown className="font-sans text-sm leading-relaxed text-gray-800 prose prose-sm max-w-none prose-p:my-1 prose-strong:font-semibold prose-em:italic prose-a:text-blue-600 prose-a:underline">
          {question.text}
        </ReactMarkdown>
      ) : (
        <p className="font-sans text-sm leading-relaxed text-gray-800">
          {question.text}
        </p>
      )}
    </div>
  );
}
