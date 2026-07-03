import type { JSX } from "react";

export type IconName =
  | "home" | "search" | "lists" | "profile" | "sun" | "moon"
  | "heart" | "heart-filled" | "comment" | "star" | "star-filled"
  | "plus" | "settings" | "camera" | "check" | "trending" | "user-plus" | "back" | "dots" | "logout" | "lock" | "bell" | "download" | "shield" | "community";

const PATHS: Record<IconName, JSX.Element> = {
  home: <><path d="M3.5 11.5 12 4l8.5 7.5" /><path d="M5.5 10v9.5a.5.5 0 0 0 .5.5h12a.5.5 0 0 0 .5-.5V10" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>,
  lists: <><rect x="3.5" y="4.5" width="17" height="6" rx="1.5" /><path d="M3.5 14.5h11M3.5 18.5h11" /></>,
  profile: <><circle cx="12" cy="8" r="3.6" /><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></>,
  moon: <path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5Z" />,
  heart: <path d="M12 20s-7-4.4-9.2-8.6C1.2 8.3 2.8 5 6 5c2 0 3.2 1.2 4 2.4C10.8 6.2 12 5 14 5c3.2 0 4.8 3.3 3.2 6.4C19 15.6 12 20 12 20Z" />,
  "heart-filled": <path d="M12 20s-7-4.4-9.2-8.6C1.2 8.3 2.8 5 6 5c2 0 3.2 1.2 4 2.4C10.8 6.2 12 5 14 5c3.2 0 4.8 3.3 3.2 6.4C19 15.6 12 20 12 20Z" fill="currentColor" stroke="none" />,
  comment: <path d="M20 11.5c0 3.6-3.6 6.5-8 6.5-1 0-2-.15-2.9-.43L4 19l1.2-3.1A6.3 6.3 0 0 1 4 11.5C4 7.9 7.6 5 12 5s8 2.9 8 6.5Z" />,
  star: <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.3-4.8-2.5-4.8 2.5.9-5.3L4.2 9.7l5.4-.8L12 4Z" />,
  "star-filled": <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.3-4.8-2.5-4.8 2.5.9-5.3L4.2 9.7l5.4-.8L12 4Z" fill="currentColor" stroke="none" />,
  plus: <path d="M12 5v14M5 12h14" />,
  settings: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2.4" /><circle cx="8" cy="17" r="2.4" /></>,
  camera: <><path d="M4.5 8.5h2.2l1.2-1.8h6.2l1.2 1.8h2.2a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 17V10a1.5 1.5 0 0 1 1.5-1.5Z" /><circle cx="12" cy="13.5" r="3" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  trending: <><path d="M3.5 16.5 9.5 10l4 4 7-7.5" /><path d="M16 6.5h4.5V11" /></>,
  "user-plus": <><circle cx="9" cy="8" r="3.4" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><path d="M18 8v5M15.5 10.5h5" /></>,
  back: <path d="M14 6l-6 6 6 6" />,
  dots: <><circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" /></>,
  logout: <><path d="M14 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h8" /><path d="M17 8.5 20.5 12 17 15.5M9.5 12h11" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
  download: <><path d="M12 4v10m0 0 4-4m-4 4-4-4" /><path d="M5 19.5h14" /></>,
  shield: <path d="M12 3 5 5.5v5c0 4.2 2.9 7.8 7 9 4.1-1.2 7-4.8 7-9v-5L12 3Z" />,
  community: <><circle cx="8" cy="9" r="2.6" /><circle cx="16" cy="9" r="2.6" /><path d="M3.5 19a4.5 4.5 0 0 1 9 0M11.5 19a4.5 4.5 0 0 1 9 0" /></>,
};

export function Icon({ name, size = 22, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" overflow="visible"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      className={`block shrink-0${className ? ` ${className}` : ""}`} aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
