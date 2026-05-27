"use client"

import type React from "react"
import { useState, useEffect } from "react"

import { Sidebar } from "./sidebar"

interface AppLayoutProps {
  children: React.ReactNode
  showSidebar?: boolean
}

export function AppLayout({ children, showSidebar = true }: AppLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  useEffect(() => {
    const savedState = localStorage.getItem("sidebar-collapsed")
    if (savedState !== null) {
      setIsSidebarCollapsed(JSON.parse(savedState))
    }
  }, [])

  const handleSidebarToggle = () => {
    const newState = !isSidebarCollapsed
    setIsSidebarCollapsed(newState)
    localStorage.setItem("sidebar-collapsed", JSON.stringify(newState))
  }

  if (!showSidebar) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={handleSidebarToggle} />
      <main className="flex-1 flex flex-col h-screen">{children}</main>
    </div>
  )
}
