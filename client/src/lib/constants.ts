// client/src/lib/constants.ts

// Languages (ISO codes with labels and flags)
export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ru", label: "Russian", flag: "🇷🇺" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "pt", label: "Portuguese", flag: "🇵🇹" },
  { code: "nl", label: "Dutch", flag: "🇳🇱" },
  { code: "pl", label: "Polish", flag: "🇵🇱" },
  { code: "sv", label: "Swedish", flag: "🇸🇪" },
  { code: "no", label: "Norwegian", flag: "🇳🇴" },
  { code: "da", label: "Danish", flag: "🇩🇰" },
  { code: "fi", label: "Finnish", flag: "🇫🇮" },
  { code: "cs", label: "Czech", flag: "🇨🇿" },
  { code: "sk", label: "Slovak", flag: "🇸🇰" },
  { code: "hu", label: "Hungarian", flag: "🇭🇺" },
  { code: "ro", label: "Romanian", flag: "🇷🇴" },
  { code: "uk", label: "Ukrainian", flag: "🇺🇦" },
  { code: "ar", label: "Arabic", flag: "🇸🇦" },
  { code: "zh", label: "Chinese (Mandarin)", flag: "🇨🇳" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "ko", label: "Korean", flag: "🇰🇷" },
  { code: "hi", label: "Hindi", flag: "🇮🇳" },
  { code: "fa", label: "Persian (Farsi)", flag: "🇮🇷" },
  { code: "tr", label: "Turkish", flag: "🇹🇷" },
  { code: "he", label: "Hebrew", flag: "🇮🇱" },
  { code: "el", label: "Greek", flag: "🇬🇷" },
  { code: "id", label: "Indonesian", flag: "🇮🇩" },
  { code: "th", label: "Thai", flag: "🇹🇭" },
  { code: "vi", label: "Vietnamese", flag: "🇻🇳" },
];

// Proficiency levels (CEFR)
export const PROFICIENCY_LEVELS = [
  { value: "A1", label: "A1 — Beginner" },
  { value: "A2", label: "A2 — Elementary" },
  { value: "B1", label: "B1 — Intermediate" },
  { value: "B2", label: "B2 — Upper-intermediate" },
  { value: "C1", label: "C1 — Advanced" },
  { value: "C2", label: "C2 — Mastery" },
];

// Cities used in filters
export const CITIES = [
  "Moscow",
  "London",
  "New York",
  "Singapore",
  "Dubai",
  "Sydney",
  "Berlin",
  "Paris",
  "Tokyo",
  "Shanghai",
];

// Event categories – import from shared if needed, or define here
export const EVENT_CATEGORIES = [
  { value: "networking", label: "Networking", icon: "🔗" },
  { value: "tech", label: "Technology", icon: "💻" },
  { value: "culture", label: "Culture", icon: "🎨" },
  { value: "food", label: "Food", icon: "🍔" },
  { value: "sports", label: "Sports", icon: "⚽" },
  { value: "music", label: "Music", icon: "🎵" },
  { value: "language", label: "Language", icon: "🌍" },
  { value: "outdoor", label: "Outdoor", icon: "🏕️" },
  { value: "games", label: "Games", icon: "🎮" },
  { value: "business", label: "Business", icon: "💼" },
  { value: "wellness", label: "Wellness", icon: "🧘" },
  { value: "family", label: "Family", icon: "👨‍👩‍👧" },
  { value: "social", label: "Social", icon: "🤝" },
  { value: "volunteering", label: "Volunteering", icon: "🙌" },
  { value: "other", label: "Other", icon: "📌" },
];
