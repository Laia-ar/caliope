"use client"

import { useEffect, useMemo, useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface TimeAgoProps {
  value?: Date | string | number
  className?: string
  updateIntervalMs?: number
}

export function TimeAgo({ value, className, updateIntervalMs = 60_000 }: TimeAgoProps) {
  const targetDate = useMemo(() => {
    if (!value) {
      return null
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value
    }

    if (typeof value === "number") {
      const dateFromNumber = new Date(value)
      return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber
    }

    if (typeof value === "string") {
      const trimmed = value.trim()
      if (!trimmed) {
        return null
      }

      const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)
      const normalized = hasTimezone ? trimmed : `${trimmed}Z`
      const dateFromIso = new Date(normalized)

      if (!Number.isNaN(dateFromIso.getTime())) {
        return dateFromIso
      }

      const fallbackDate = new Date(value)
      return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate
    }

    return null
  }, [value])

  const [, forceNow] = useState(() => Date.now())

  useEffect(() => {
    if (!targetDate) {
      return
    }

    const interval = window.setInterval(() => {
      forceNow(Date.now())
    }, updateIntervalMs)

    return () => {
      window.clearInterval(interval)
    }
  }, [targetDate, updateIntervalMs])

  if (!targetDate) {
    return <span className={className}>Reciente</span>
  }

  const relativeTimeRaw = formatDistanceToNow(targetDate, { addSuffix: true, locale: es })
  const relativeTime = relativeTimeRaw.replace(/\balrededor de\s+/i, "")
  const absoluteTime = format(targetDate, "HH:mm dd/MM/yyyy")

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("cursor-default", className)}>{relativeTime}</span>
        </TooltipTrigger>
        <TooltipContent>{absoluteTime}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
