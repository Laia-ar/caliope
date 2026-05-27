"use client"

import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ActionTooltipProps {
  label: ReactNode
  children: ReactElement<{ title?: string; "aria-label"?: string }>
  delayDuration?: number
  ariaLabel?: string
}

export function ActionTooltip({
  label,
  children,
  delayDuration = 150,
  ariaLabel,
}: ActionTooltipProps) {
  const stringLabel = typeof label === "string" ? label : undefined
  const accessibleLabel = ariaLabel ?? stringLabel

  const enhancedChild = isValidElement(children)
    ? cloneElement(children, {
        ...(accessibleLabel && !children.props?.["aria-label"] ? { "aria-label": accessibleLabel } : {}),
      })
    : children

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{enhancedChild}</TooltipTrigger>
        <TooltipContent>
          {stringLabel ? <span>{stringLabel}</span> : label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
