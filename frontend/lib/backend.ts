// In production/docker, use relative URLs for API calls (proxied through Next.js rewrites)
// Use full URL for OAuth redirects or when explicitly needed
const isServer = typeof window === 'undefined'
const DEFAULT_BACKEND_URL = "http://127.0.0.1:5000"

export function getBackendBaseUrl(): string {
  // Always use the configured backend URL
  // NEXT_PUBLIC_BACKEND_URL must be set at build time for browser use
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL
  }
  if (!isServer && typeof window !== 'undefined') {
    // Fallback: derive from current location (works for relative paths)
    return window.location.origin
  }
  return process.env.BACKEND_URL || DEFAULT_BACKEND_URL
}

export function buildBackendUrl(path: string, forceRelative = false): string {
  const base = getBackendBaseUrl()
  
  // For API calls, use relative URLs to go through Next.js rewrites
  // This avoids CORS issues and works with the proxy
  if (forceRelative || path.startsWith('/api/')) {
    return path
  }
  
  return new URL(path, base).toString()
}
