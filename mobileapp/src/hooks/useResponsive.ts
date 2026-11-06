import { useWindowDimensions } from "react-native";

const breakpoints = {
  compact: 360,
  tablet: 768,
} as const;

export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();
  const isCompact = width < breakpoints.compact;
  const isTablet = width >= breakpoints.tablet;

  return {
    width,
    height,
    fontScale,
    isCompact,
    isTablet,
    horizontalPadding: isCompact ? 16 : isTablet ? 32 : 20,
  };
}