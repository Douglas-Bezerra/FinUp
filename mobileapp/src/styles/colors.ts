export const colors = {
  background: "#000000",
  foreground: "#F0F0F8",

  card: "#111120",
  cardForeground: "#E8E8F4",

  gradient: {
    colors: [
      "#FFB000",
      "#FF6B00",
      "#FF3040",
      "#FF006A",
      "#D500F9",
    ],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },

  primaryForeground: "#031A09",

  secondary: "#1A1A2E",
  secondaryForeground: "#B0B0C8",

  muted: "#161625",
  mutedForeground: "#6E6E8E",

  border: "#1E1E34",

  danger: "#FF6B6B",
  warning: "#FBBF24",
  info: "#60A5FA",
} as const;