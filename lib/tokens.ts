/**
 * Global Design System Tokens
 * Platform Visual Identity: Dark Slate + Soft White + Burnt Orange
 */

export const COLORS = {
  background: {
    main: "#111111",
    secondary: "#171717",
  },
  surfaces: {
    card: "#1D1D1D",
    elevated: "#252525",
  },
  typography: {
    primary: "#F5F5F3",
    secondary: "#B0B0AE",
    muted: "#777777",
  },
  borders: {
    subtle: "#303030",
    default: "#303030",
    strong: "#444444",
  },
  accent: {
    orange: "#D88762",
    orangeHover: "#E39A76",
  },
  semantic: {
    success: "#83B69A",
    warning: "#D6AD72",
    error: "#D77D7D",
  },
} as const;

export const RADII = {
  control: "6px",
  button: "8px",
  input: "8px",
  card: "10px",
  panel: "14px",
  pill: "9999px",
} as const;

export const LAYOUT = {
  maxWidth: 1200,
  navbarHeight: 72,
  padding: {
    desktop: 48,
    tablet: 32,
    mobile: 20,
  },
} as const;

export const SPACING = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  6: "24px",
  8: "32px",
  12: "48px",
  16: "64px",
  24: "96px",
  32: "128px",
} as const;
