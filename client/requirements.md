## Packages
framer-motion | Beautiful page transitions, micro-interactions, and scroll effects
html2pdf.js | Client-side PDF generation for downloading event tickets
date-fns | Robust and clean date formatting for event times
@hookform/resolvers | For Zod validation in forms
lucide-react | Used extensively for iconography

## Notes
Tailwind Config - extend fontFamily:
fontFamily: {
  sans: ["var(--font-sans)"],
  display: ["var(--font-display)"],
}
Tailwind Config - add colors:
We are using a rich Ruby Red / Coral as the primary brand color to give the app a warm, inviting, premium feel.

Authentication is handled natively by the existing `useAuth` hook and `/api/login` route.
