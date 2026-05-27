import { useEffect, useState } from "react"

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)")
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches)
    }

    setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  return isMobile
}
