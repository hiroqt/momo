import React, { useId } from 'react';
import Svg, { Defs, LinearGradient, Stop, Ellipse, Path, Rect, Circle, G } from 'react-native-svg';

export type StudyIconName = 'book' | 'cards' | 'folder' | 'brain' | 'heart' | 'coin' | 'streak' | 'shield' | 'camera' | 'settings';

/** Small clay illustrations: shared lighting, extruded edges and a soft ground shadow. */
export function StudyIcon({ name, size = 48 }: { name: StudyIconName; size?: number }) {
  const id = useId().replace(/:/g, '');
  const violet = `url(#${id}v)`;
  const peach = `url(#${id}p)`;
  const paper = `url(#${id}w)`;
  const gold = `url(#${id}g)`;
  const shape = () => {
    switch (name) {
      case 'book': return <><Path d="M11 18 Q23 12 32 18 Q44 12 54 18 L54 49 Q44 44 32 50 Q23 44 11 49Z" fill="#5847B5"/><Path d="M9 14 Q23 8 32 15 Q44 8 53 14 L53 44 Q44 39 32 46 Q23 39 9 44Z" fill={paper}/><Path d="M32 16V45" stroke="#B6A8DF" strokeWidth="2"/><Path d="M15 21L26 21M15 27L25 27M38 21L47 21M38 27L47 27" stroke="#B6A8DF" strokeWidth="2" strokeLinecap="round"/></>;
      case 'cards': return <><Rect x="17" y="12" width="35" height="39" rx="8" transform="rotate(12 35 32)" fill="#5847B5"/><Rect x="9" y="12" width="35" height="39" rx="8" transform="rotate(-9 27 31)" fill={violet}/><Rect x="15" y="20" width="23" height="24" rx="5" fill={paper}/><Path d="M21 27H32M21 33H29" stroke="#9382D4" strokeWidth="3" strokeLinecap="round"/></>;
      case 'folder': return <><Path d="M8 18Q8 12 14 12H26L32 18H49Q55 18 55 24V47Q55 52 49 52H14Q8 52 8 46Z" fill="#5847B5"/><Path d="M9 24H52Q57 24 55 30L50 47Q49 50 44 50H13Q8 50 9 44Z" fill={violet}/><Path d="M18 32H37" stroke="#E4DCFF" strokeWidth="3" strokeLinecap="round"/></>;
      case 'heart': return <Path d="M32 51L12 32C0 15 21 5 32 19C43 5 64 15 52 32Z" fill={peach} stroke="#CD776E" strokeWidth="2"/>;
      case 'coin': return <><Ellipse cx="34" cy="33" rx="22" ry="23" fill="#C28A32"/><Ellipse cx="30" cy="29" rx="22" ry="23" fill={gold}/><Ellipse cx="30" cy="29" rx="16" ry="17" fill="none" stroke="#FFF1AE" strokeWidth="2"/><Path d="M26 36V23L30 29L35 23V36" stroke="#A96D25" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>;
      case 'streak': return <><Path d="M31 5C34 21 50 19 51 36C53 59 10 60 12 36C13 25 22 22 23 14L30 25C33 19 33 12 31 5Z" fill={peach}/><Path d="M32 28C33 36 42 39 39 47C35 55 22 51 23 44C24 37 30 36 32 28Z" fill={gold}/></>;
      case 'shield': return <><Path d="M32 9L52 17V32Q52 46 32 55Q12 46 12 32V17Z" fill="#5847B5"/><Path d="M30 6L50 14V29Q50 43 30 52Q10 43 10 29V14Z" fill={violet}/><Path d="M20 28L27 35L40 21" stroke="#FFF8F0" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>;
      case 'camera': return <><Rect x="8" y="19" width="49" height="34" rx="9" fill="#5847B5"/><Rect x="7" y="16" width="49" height="34" rx="9" fill={violet}/><Rect x="18" y="10" width="19" height="12" rx="4" fill={violet}/><Circle cx="31" cy="32" r="12" fill={paper}/><Circle cx="31" cy="32" r="7" fill="#8B78C9"/><Circle cx="46" cy="23" r="2" fill="#FFF8F0"/></>;
      case 'settings': return <><Path d="M24 8H39L41 16L49 19L55 29L49 36L47 45L36 53L28 49L18 48L9 36L14 28L14 18Z" fill="#5847B5"/><Path d="M22 5H37L39 13L47 16L53 26L47 33L45 42L34 50L26 46L16 45L7 33L12 25L12 15Z" fill={violet}/><Circle cx="30" cy="28" r="10" fill={paper}/><Circle cx="30" cy="28" r="5" fill="#B9AADC"/></>;
      case 'brain': return <><Path d="M30 13C22 3 12 13 15 21C3 22 5 36 12 38C9 50 23 55 30 46C37 55 52 49 49 38C60 32 55 22 47 21C51 10 37 4 30 13Z" fill={violet}/><Path d="M30 14V44M19 19Q27 22 22 29M13 33Q23 30 24 39M42 19Q34 22 39 29M48 33Q38 30 37 39" stroke="#DDD2FF" strokeWidth="2.5" fill="none" strokeLinecap="round"/></>;
    }
  };
  return <Svg width={size} height={size} viewBox="0 0 64 64" accessible={false}>
    <Defs>
      <LinearGradient id={`${id}v`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#C4B6FF"/><Stop offset="0.45" stopColor="#9A86ED"/><Stop offset="1" stopColor="#6D5CE7"/></LinearGradient>
      <LinearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFD4BC"/><Stop offset="0.5" stopColor="#FFB697"/><Stop offset="1" stopColor="#DB807C"/></LinearGradient>
      <LinearGradient id={`${id}w`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFFFFF"/><Stop offset="1" stopColor="#EAE1F7"/></LinearGradient>
      <LinearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFF0B3"/><Stop offset="0.5" stopColor="#F7CB67"/><Stop offset="1" stopColor="#E5AA46"/></LinearGradient>
    </Defs>
    <Ellipse cx="32" cy="57" rx="21" ry="3" fill="#44325F" opacity="0.10"/>
    <G>{shape()}</G>
  </Svg>;
}
