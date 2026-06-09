import Backpack from '@lucide/svelte/icons/backpack';
import Bell from '@lucide/svelte/icons/bell';
import BriefcaseBusiness from '@lucide/svelte/icons/briefcase-business';
import Calendar from '@lucide/svelte/icons/calendar';
import CalendarDays from '@lucide/svelte/icons/calendar-days';
import Dumbbell from '@lucide/svelte/icons/dumbbell';
import House from '@lucide/svelte/icons/house';
import ListChecks from '@lucide/svelte/icons/list-checks';
import MapPinned from '@lucide/svelte/icons/map-pinned';
import MessageSquareText from '@lucide/svelte/icons/message-square-text';
import Palette from '@lucide/svelte/icons/palette';
import Plus from '@lucide/svelte/icons/plus';
import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
import Sparkles from '@lucide/svelte/icons/sparkles';
import SquareCheckBig from '@lucide/svelte/icons/square-check-big';
import Stethoscope from '@lucide/svelte/icons/stethoscope';
import Trees from '@lucide/svelte/icons/trees';
import UsersRound from '@lucide/svelte/icons/users-round';
import WalletCards from '@lucide/svelte/icons/wallet-cards';

export const ICONS = {
  backpack: Backpack,
  bell: Bell,
  'briefcase-business': BriefcaseBusiness,
  calendar: Calendar,
  'calendar-days': CalendarDays,
  dumbbell: Dumbbell,
  house: House,
  'list-checks': ListChecks,
  'map-pinned': MapPinned,
  'message-square-text': MessageSquareText,
  palette: Palette,
  plus: Plus,
  'shopping-bag': ShoppingBag,
  sparkles: Sparkles,
  'square-check-big': SquareCheckBig,
  stethoscope: Stethoscope,
  trees: Trees,
  'users-round': UsersRound,
  'wallet-cards': WalletCards
} as const;

export type IconName = keyof typeof ICONS;

export function getIcon(icon: IconName) {
  return ICONS[icon];
}
