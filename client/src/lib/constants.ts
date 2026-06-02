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

// City → IANA timezone map (covers all CITIES entries + common event cities)
export const CITY_TIMEZONES: Record<string, string> = {
  "Moscow":       "Europe/Moscow",
  "London":       "Europe/London",
  "New York":     "America/New_York",
  "Singapore":    "Asia/Singapore",
  "Dubai":        "Asia/Dubai",
  "Sydney":       "Australia/Sydney",
  "Berlin":       "Europe/Berlin",
  "Paris":        "Europe/Paris",
  "Tokyo":        "Asia/Tokyo",
  "Shanghai":     "Asia/Shanghai",
  // extras that may appear in event venueCity
  "Saint Petersburg": "Europe/Moscow",
  "St Petersburg":    "Europe/Moscow",
  "Novosibirsk":      "Asia/Novosibirsk",
  "Yekaterinburg":    "Asia/Yekaterinburg",
  "Amsterdam":        "Europe/Amsterdam",
  "Rome":             "Europe/Rome",
  "Madrid":           "Europe/Madrid",
  "Istanbul":         "Europe/Istanbul",
  "Bangkok":          "Asia/Bangkok",
  "Hong Kong":        "Asia/Hong_Kong",
  "Seoul":            "Asia/Seoul",
  "Mumbai":           "Asia/Kolkata",
  "Delhi":            "Asia/Kolkata",
  "Riyadh":           "Asia/Riyadh",
  "Doha":             "Asia/Qatar",
  "Cairo":            "Africa/Cairo",
  "Nairobi":          "Africa/Nairobi",
  "Lagos":            "Africa/Lagos",
  "São Paulo":        "America/Sao_Paulo",
  "Toronto":          "America/Toronto",
  "Los Angeles":      "America/Los_Angeles",
  "Chicago":          "America/Chicago",
  "Mexico City":      "America/Mexico_City",
  "Buenos Aires":     "America/Argentina/Buenos_Aires",
};

/**
 * Returns the IANA timezone string for a given city name.
 * Falls back to the event's venueCity, then to UTC.
 */
export function cityToTimezone(city?: string | null): string {
  if (!city) return "UTC";
  // Case-insensitive lookup
  const key = Object.keys(CITY_TIMEZONES).find(
    k => k.toLowerCase() === city.toLowerCase()
  );
  return key ? CITY_TIMEZONES[key] : "UTC";
}
