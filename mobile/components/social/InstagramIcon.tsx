import React from 'react';
import Svg, { Rect, Circle } from 'react-native-svg';

export interface InstagramIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Authentic Instagram camera glyph rendered via vector SVG.
 */
export const InstagramIcon: React.FC<InstagramIconProps> = ({
  size = 20,
  color = '#FFFFFF',
  strokeWidth = 2,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect
      x="2.5"
      y="2.5"
      width="19"
      height="19"
      rx="5.5"
      stroke={color}
      strokeWidth={strokeWidth}
    />
    <Circle
      cx="12"
      cy="12"
      r="4.2"
      stroke={color}
      strokeWidth={strokeWidth}
    />
    <Circle
      cx="17.2"
      cy="6.8"
      r="1.2"
      fill={color}
    />
  </Svg>
);
