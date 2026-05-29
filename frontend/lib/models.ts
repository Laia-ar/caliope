export const MODEL_OPTIONS = [
  { value: "google/gemini-2.0-flash-001", label: "Google Gemini" },
  { value: "mistralai/mistral-nemo", label: "Mistral Nemo" },
  { value: "deepseek/deepseek-chat-v3-0324", label: "DeepSeek" },
  { value: "qwen/qwen-2.5-7b-instruct", label: "Qwen 2.5 7B" },
  { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
] as const

export type ModelValue = (typeof MODEL_OPTIONS)[number]["value"]
