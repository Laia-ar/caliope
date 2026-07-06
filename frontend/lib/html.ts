import DOMPurify from "dompurify"

export function decodeHtmlEntities(html: string): string {
  if (typeof window === "undefined") return html
  const textarea = document.createElement("textarea")
  textarea.innerHTML = html
  return textarea.value
}

export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return html
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "strike",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "span",
      "div",
    ],
    ALLOWED_ATTR: ["class", "style"],
  })
}

export function renderHtmlContent(html: string): string {
  return sanitizeHtml(decodeHtmlEntities(html || "")).replace(/\n/g, "<br/>")
}
