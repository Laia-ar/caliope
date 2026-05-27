"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface UseNavigationGuardProps {
  hasUnsavedChanges: boolean;
  message?: string;
}

export function useNavigationGuard({
  hasUnsavedChanges,
  message = "Tenés cambios sin guardar que se van a perder. ¿Querés salir sin guardar?",
}: UseNavigationGuardProps) {
  const router = useRouter();
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);

  // Update ref when hasUnsavedChanges changes
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    // Handle browser navigation (back/forward/refresh/close)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    // Handle Next.js router navigation
    const handleRouteChange = () => {
      if (hasUnsavedChangesRef.current) {
        const confirmed = window.confirm(message);
        if (!confirmed) {
          // Prevent navigation by throwing an error
          throw new Error("Navigation cancelled by user");
        }
      }
    };

    // Add event listeners
    window.addEventListener("beforeunload", handleBeforeUnload);

    // For Next.js App Router, we need to intercept navigation differently
    // We'll override the router methods temporarily
    const originalPush = router.push;
    const originalReplace = router.replace;
    const originalBack = router.back;

    router.push = (href: string, options?: any) => {
      if (hasUnsavedChangesRef.current) {
        const confirmed = window.confirm(message);
        if (!confirmed) {
          return Promise.resolve(true);
        }
      }
      return originalPush.call(router, href, options);
    };

    router.replace = (href: string, options?: any) => {
      if (hasUnsavedChangesRef.current) {
        const confirmed = window.confirm(message);
        if (!confirmed) {
          return Promise.resolve(true);
        }
      }
      return originalReplace.call(router, href, options);
    };

    router.back = () => {
      if (hasUnsavedChangesRef.current) {
        const confirmed = window.confirm(message);
        if (!confirmed) {
          return;
        }
      }
      return originalBack.call(router);
    };

    // Cleanup
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      router.push = originalPush;
      router.replace = originalReplace;
      router.back = originalBack;
    };
  }, [router, message]);
}
