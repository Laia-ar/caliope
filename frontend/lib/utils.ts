import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isMarkdown(text: string): boolean {
  if (!text) return false;

  // Check for common markdown patterns
  const markdownPatterns = [
    /\*\*.*\*\*/, // Bold text
    /\*.*\*/, // Italic text (but not bold)
    /^#+\s/m, // Headers
    /\[.*\]$$.*$$/, // Links
    /^-\s/m, // Unordered lists
    /^\d+\.\s/m, // Ordered lists
    /`.*`/, // Inline code
    /```[\s\S]*```/, // Code blocks
    /^>/m, // Blockquotes
  ];

  return markdownPatterns.some((pattern) => pattern.test(text));
}
