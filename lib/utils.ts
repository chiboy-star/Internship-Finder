import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return "just now";
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays === 1) {
      return "yesterday";
    }
    return `${diffDays}d ago`;
  } catch {
    return dateString;
  }
}

export function formatDeadline(dateString: string | null): { text: string; isClosingSoon: boolean; isPast: boolean } {
  if (!dateString) {
    return { text: "Rolling / No deadline", isClosingSoon: false, isPast: false };
  }

  try {
    const deadline = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: "Closed", isClosingSoon: false, isPast: true };
    }
    if (diffDays === 0) {
      return { text: "Closes today", isClosingSoon: true, isPast: false };
    }
    if (diffDays === 1) {
      return { text: "Closes tomorrow", isClosingSoon: true, isPast: false };
    }
    if (diffDays <= 7) {
      return { text: `Closes in ${diffDays} days`, isClosingSoon: true, isPast: false };
    }
    return {
      text: `Closes ${deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      isClosingSoon: false,
      isPast: false,
    };
  } catch {
    return { text: dateString, isClosingSoon: false, isPast: false };
  }
}

