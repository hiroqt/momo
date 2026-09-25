import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon, AlertCircleIcon, AppleIcon, ArrowLeft01Icon, ArrowRight01Icon,
  ArrowTurnUpIcon, ArrowUp01Icon, ArrowUpRight01Icon, BananaIcon, Cancel01Icon,
  Cards01Icon, CheckmarkSquare01Icon, Download01Icon, HeartIcon, MenuTwoLineIcon,
  NoteEditIcon, PlayStoreIcon, RefreshIcon, SparklesIcon, Tick02Icon,
  VolumeHighIcon, VolumeOffIcon,
} from '@hugeicons/core-free-icons';

const icons = {
  add: Add01Icon,
  alert: AlertCircleIcon,
  apple: AppleIcon,
  arrowLeft: ArrowLeft01Icon,
  arrowRight: ArrowRight01Icon,
  arrowTurnUp: ArrowTurnUpIcon,
  arrowUp: ArrowUp01Icon,
  arrowUpRight: ArrowUpRight01Icon,
  banana: BananaIcon,
  close: Cancel01Icon,
  cards: Cards01Icon,
  quiz: CheckmarkSquare01Icon,
  download: Download01Icon,
  heart: HeartIcon,
  menu: MenuTwoLineIcon,
  note: NoteEditIcon,
  playStore: PlayStoreIcon,
  refresh: RefreshIcon,
  sparkle: SparklesIcon,
  check: Tick02Icon,
  volumeOn: VolumeHighIcon,
  volumeOff: VolumeOffIcon,
} as const;

/** Decorative icons; put accessible labels on the containing control. */
export default function Icon({ name, size = 20, className = '' }: {
  name: keyof typeof icons;
  size?: number | string;
  className?: string;
}) {
  return <HugeiconsIcon icon={icons[name]} size={size} strokeWidth={1.8} color="currentColor" className={`momo-icon ${className}`} aria-hidden="true" focusable="false" />;
}
