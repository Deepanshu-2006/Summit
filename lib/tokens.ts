/**
 * Global Design System Tokens
 * Platform Visual Identity: Dark Slate + Soft White + Burnt Orange
 */

export const COLORS = {
  background: {
    main: "#121416",
    secondary: "#191C1F",
  },
  surfaces: {
    card: "#202427",
    elevated: "#292E32",
  },
  typography: {
    primary: "#F1F0EC",
    secondary: "#A6AAA9",
    muted: "#777D7D",
  },
  borders: {
    default: "#343A3D",
    subtle: "#292E31",
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
