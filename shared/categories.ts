// shared/categories.ts
// Single source of truth for event categories.
// Used in:
//   - Event creation dropdown (CreateEvent.tsx)
//   - User profile interests selector
//   - Telegram bot /setcategory filter
//   - Notification subscriber filtering

export const EVENT_CATEGORIES = [
  { value: "networking",   label: "Networking",         icon: "🤝" },
  { value: "tech",         label: "Tech & Innovation",  icon: "💻" },
  { value: "culture",      label: "Arts & Culture",     icon: "🎨" },
  { value: "food",         label: "Food & Drink",       icon: "🍽️" },
  { value: "sports",       label: "Sports & Fitness",   icon: "⚽" },
  { value: "music",        label: "Music & Nightlife",  icon: "🎵" },
  { value: "language",     label: "Language Exchange",  icon: "🗣️" },
  { value: "outdoor",      label: "Outdoor & Travel",   icon: "🌿" },
  { value: "games",        label: "Games & Hobbies",    icon: "🎮" },
  { value: "business",     label: "Business & Finance", icon: "💼" },
  { value: "wellness",     label: "Health & Wellness",  icon: "🧘" },
  { value: "family",       label: "Family & Kids",      icon: "👨‍👩‍👧" },
  { value: "social",       label: "Social & Meetups",   icon: "🎉" },
  { value: "volunteering", label: "Volunteering",       icon: "🙌" },
  { value: "other",        label: "Other",              icon: "✨" },
] as const;

export type EventCategory = typeof EVENT_CATEGORIES[number]["value"];

// For use in Zod schemas
export const EVENT_CATEGORY_VALUES = EVENT_CATEGORIES.map(c => c.value) as [string, ...string[]];

// Helper — get display label from value
export function getCategoryLabel(value: string): string {
  return EVENT_CATEGORIES.find(c => c.value === value)?.label ?? value;
}
