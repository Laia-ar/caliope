"use client"

import type React from "react"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { LogOut, ChevronLeft, ChevronRight } from "lucide-react"

import { HelpModal } from "./help-modal"
import Image from "next/image"

interface SidebarProps {
  isCollapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ isCollapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [canCreateInvites, setCanCreateInvites] = useState(false)

  useEffect(() => {
    let cancelled = false

    const checkAdmin = async () => {
      try {
        const response = await fetch("/api/check-auth", {
          credentials: "include",
        })

        if (!response.ok) {
          return
        }

        const data = await response.json().catch(() => null)
        if (!cancelled && data && typeof data.username === "string") {
          setIsAdminUser(data.username.toLowerCase() === "admin")
          setCanCreateInvites(data.can_create_invites === true)
        }
      } catch (error) {
        // Ignored on purpose: sidebar remains without admin link if request fails
      }
    }

    void checkAdmin()

    return () => {
      cancelled = true
    }
  }, [])

  const baseNavItems = [
    {
      href: "/write",
      label: "Crear texto",
      icon: "/icons/crear-icon.svg",
      iconAlt: "Crear nuevo texto",
    },
    {
      href: "/documents",
      label: "Mis textos",
      icon: "/icons/documents-icon.svg",
      iconAlt: "Ver mis textos",
    },
    {
      href: "/prompts",
      label: "Prompts",
      icon: "/icons/prompt-icon.svg",
      iconAlt: "Gestionar prompts",
    },
  ]

  let navItems = baseNavItems
  if (canCreateInvites) {
    navItems = [
      ...navItems,
      {
        href: "/invitations",
        label: "Invitaciones",
        icon: "/icons/help-icon.svg",
        iconAlt: "Invitaciones",
      },
    ]
  }
  if (isAdminUser) {
    navItems = [
      ...navItems,
      {
        href: "/admin",
        label: "Administración",
        icon: "/icons/help-icon.svg",
        iconAlt: "Panel de administración",
      },
    ]
  }

  const handleHelpClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsHelpModalOpen(true)
  }

  const handleLogout = async () => {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)

    try {
      const response = await fetch("/logout", {
        credentials: "include",
        redirect: "follow",
      })

      if (!response.ok) {
        console.error("Logout failed", response.status, await response.text().catch(() => ""))
      }
    } catch (error) {
      console.error("Error during logout", error)
    } finally {
      setIsLoggingOut(false)
      router.replace("/auth")
    }
  }

  return (
    <>
      <div
        className={`flex flex-col h-screen transition-all duration-300 ${isCollapsed ? "w-16" : "w-64"} relative`}
        style={{ backgroundColor: "#FAFAFA" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Logo and Toggle Button */}
        <div className={`border-b border-gray-200 ${isCollapsed ? "p-3" : "p-6"} relative`}>
          <div className="flex items-center justify-between ml-2">
            {isCollapsed ? (
              <button
                onClick={onToggle}
                className="flex items-center gap-2 text-gray-800 hover:text-gray-900 transition-colors"
                title="Expandir navegación"
              >
                <Image
                  src="/images/caliope-logo.svg"
                  alt="Calíope"
                  width={32}
                  height={32}
                  className="w-8 h-8 flex-shrink-0"
                />
              </button>
            ) : (
              <Link href="/" className="flex items-center gap-2 text-gray-800">
                <Image
                  src="/images/caliope-logo.svg"
                  alt="Calíope"
                  width={32}
                  height={32}
                  className="w-8 h-8 flex-shrink-0"
                />
                <span className="font-semibold text-lg">Calíope</span>
              </Link>
            )}

            <button
              onClick={onToggle}
              className={`p-1.5 rounded-lg text-gray-600 hover:bg-gray-150 hover:text-gray-800 transition-all duration-200 ${
                isCollapsed && !isHovered ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className={`flex-1 ${isCollapsed ? "p-2" : "p-4"}`}>
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href === "/write" && pathname.startsWith("/write"))

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm  transition-colors cursor-pointer ${
                      isActive
                        ? "bg-gray-200 text-gray-900 font-medium"
                        : "text-gray-600 hover:bg-gray-150 hover:text-gray-800"
                    } ${isCollapsed ? "justify-center" : ""}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    {/* Logo */}
                    <Image
                      src={item.icon || "/placeholder.svg"}
                      alt={item.iconAlt}
                      width={16}
                      height={16}
                      className="w-4 h-4 flex-shrink-0"
                    />
                    {!isCollapsed && item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Bottom Navigation */}
        <div className={`border-t border-gray-200 ${isCollapsed ? "p-2" : "p-4"}`}>
          <ul className="space-y-2">
            <li>
              {/* Temporarily hide help button until the help flow is ready */}
              {false && (
                <button
                  onClick={handleHelpClick}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm  transition-colors text-gray-600 hover:bg-gray-150 hover:text-gray-800 w-full text-left cursor-pointer ${
                    isCollapsed ? "justify-center" : ""
                  }`}
                  title={isCollapsed ? "Ayuda" : undefined}
                >
                  <Image
                    src="/icons/help-icon.svg"
                    alt="Ayuda"
                    width={16}
                    height={16}
                    className="w-4 h-4 flex-shrink-0"
                  />
                  {!isCollapsed && "Ayuda"}
                </button>
              )}
            </li>
            <li>
              <button
                type="button"
                onClick={handleLogout}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm  transition-colors text-gray-600 hover:bg-gray-150 hover:text-gray-800 cursor-pointer w-full text-left ${
                  isCollapsed ? "justify-center" : ""
                } ${isLoggingOut ? "opacity-70 pointer-events-none" : ""}`}
                title={isCollapsed ? "Salir" : undefined}
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && "Salir"}
              </button>
            </li>
          </ul>
        </div>

        <div className={`border-t border-gray-200 ml-2.5 ${isCollapsed ? "p-2" : "p-4"}`}>
          <Link
            href="https://laia.ar/"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-left text-gray-500 hover:text-gray-700 transition-colors cursor-pointer items-start justify-start text-center ${
              isCollapsed ? "justify-center" : "flex-col gap-2"
            }`}
            title={isCollapsed ? "Desarrollado por LAIA" : undefined}
          >
            {isCollapsed ? (
              <Image src="/images/laia-icono.png" alt="LAIA" width={24} height={24} className="w-6 h-6" />
            ) : (
              <>
                <span className="text-xs">Desarrollado por:</span>
                <Image src="/images/laia.png" alt="LAIA" width={80} height={20} className="h-5 w-auto" />
              </>
            )}
          </Link>
        </div>
      </div>

      <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
    </>
  )
}
