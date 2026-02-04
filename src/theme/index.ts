// Alfie's Food Co. theme - charcoal/warm palette inspired by the logo
export const theme = {
  colors: {
    // Primary: dark charcoal matching the Alfie's badge
    primary: '#2C3E50',
    primaryLight: '#34495E',
    primaryDark: '#1A252F',

    // Accent: warm amber for CTAs and highlights
    accent: '#E67E22',
    accentLight: '#F39C12',

    // Semantic
    success: '#27AE60',
    warning: '#F39C12',
    danger: '#E74C3C',
    info: '#3498DB',

    // Surfaces
    background: '#F5F6FA',
    surface: '#FFFFFF',
    surfaceHover: '#ECF0F1',

    // Text
    text: '#2C3E50',
    textSecondary: '#7F8C8D',
    textMuted: '#95A5A6',
    textLight: '#BDC3C7',

    // Borders
    border: '#DFE6E9',
    borderLight: '#ECF0F1',

    // Base
    white: '#FFFFFF',
    black: '#000000',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
  },
};

export type Theme = typeof theme;
