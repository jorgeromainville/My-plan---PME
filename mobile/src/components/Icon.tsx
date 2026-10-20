import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Bell from 'lucide-react-native/icons/bell';
import BookOpen from 'lucide-react-native/icons/book-open';
import Brain from 'lucide-react-native/icons/brain';
import Briefcase from 'lucide-react-native/icons/briefcase';
import Building from 'lucide-react-native/icons/building';
import CalendarCheck from 'lucide-react-native/icons/calendar-check';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import CalendarPlus from 'lucide-react-native/icons/calendar-plus';
import CalendarRange from 'lucide-react-native/icons/calendar-range';
import Camera from 'lucide-react-native/icons/camera';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import Circle from 'lucide-react-native/icons/circle';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CircleDollarSign from 'lucide-react-native/icons/circle-dollar-sign';
import Clock from 'lucide-react-native/icons/clock';
import Coffee from 'lucide-react-native/icons/coffee';
import Compass from 'lucide-react-native/icons/compass';
import Contact from 'lucide-react-native/icons/contact';
import Dumbbell from 'lucide-react-native/icons/dumbbell';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import FileText from 'lucide-react-native/icons/file-text';
import Flag from 'lucide-react-native/icons/flag';
import Funnel from 'lucide-react-native/icons/funnel';
import Handshake from 'lucide-react-native/icons/handshake';
import Heart from 'lucide-react-native/icons/heart';
import House from 'lucide-react-native/icons/house';
import Hourglass from 'lucide-react-native/icons/hourglass';
import Info from 'lucide-react-native/icons/info';
import LifeBuoy from 'lucide-react-native/icons/life-buoy';
import Lightbulb from 'lucide-react-native/icons/lightbulb';
import LocateFixed from 'lucide-react-native/icons/locate-fixed';
import Lock from 'lucide-react-native/icons/lock';
import LogOut from 'lucide-react-native/icons/log-out';
import Mail from 'lucide-react-native/icons/mail';
import Map from 'lucide-react-native/icons/map';
import MapPin from 'lucide-react-native/icons/map-pin';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import MessageSquare from 'lucide-react-native/icons/message-square';
import Minus from 'lucide-react-native/icons/minus';
import Navigation from 'lucide-react-native/icons/navigation';
import Package from 'lucide-react-native/icons/package';
import Palette from 'lucide-react-native/icons/palette';
import PartyPopper from 'lucide-react-native/icons/party-popper';
import Pencil from 'lucide-react-native/icons/pencil';
import Phone from 'lucide-react-native/icons/phone';
import Plane from 'lucide-react-native/icons/plane';
import Plus from 'lucide-react-native/icons/plus';
import ReceiptText from 'lucide-react-native/icons/receipt-text';
import Repeat2 from 'lucide-react-native/icons/repeat-2';
import RotateCw from 'lucide-react-native/icons/rotate-cw';
import Save from 'lucide-react-native/icons/save';
import ScanLine from 'lucide-react-native/icons/scan-line';
import ScanText from 'lucide-react-native/icons/scan-text';
import Search from 'lucide-react-native/icons/search';
import Send from 'lucide-react-native/icons/send';
import Settings from 'lucide-react-native/icons/settings';
import Share2 from 'lucide-react-native/icons/share-2';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import ShoppingBag from 'lucide-react-native/icons/shopping-bag';
import ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Square from 'lucide-react-native/icons/square';
import SquareCheck from 'lucide-react-native/icons/square-check';
import Star from 'lucide-react-native/icons/star';
import Sun from 'lucide-react-native/icons/sun';
import Target from 'lucide-react-native/icons/target';
import Timer from 'lucide-react-native/icons/timer';
import Trash from 'lucide-react-native/icons/trash';
import TrendingDown from 'lucide-react-native/icons/trending-down';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import User from 'lucide-react-native/icons/user';
import UserPlus from 'lucide-react-native/icons/user-plus';
import Users from 'lucide-react-native/icons/users';
import Utensils from 'lucide-react-native/icons/utensils';
import Wallet from 'lucide-react-native/icons/wallet';
import WandSparkles from 'lucide-react-native/icons/wand-sparkles';
import X from 'lucide-react-native/icons/x';
import React from 'react';
import type { ColorValue } from 'react-native';
import { useThemeColors } from '../theme/colors';

// Un solo set (Lucide) para toda la app: mismo trazo, mismo tamaño óptico.
// Los únicos emojis permitidos son los pines editables del mapa (mapHtml.ts).
const ICONS = {
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  bell: Bell,
  book: BookOpen,
  brain: Brain,
  briefcase: Briefcase,
  building: Building,
  calendar: CalendarDays,
  calendarCheck: CalendarCheck,
  calendarPlus: CalendarPlus,
  calendarRange: CalendarRange,
  camera: Camera,
  chart: ChartColumn,
  check: Check,
  checkCircle: CircleCheck,
  checkSquare: SquareCheck,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronUp: ChevronUp,
  circle: Circle,
  clock: Clock,
  coffee: Coffee,
  compass: Compass,
  contact: Contact,
  dumbbell: Dumbbell,
  fileText: FileText,
  filter: Funnel,
  flag: Flag,
  handshake: Handshake,
  heart: Heart,
  home: House,
  hourglass: Hourglass,
  info: Info,
  lifeBuoy: LifeBuoy,
  lightbulb: Lightbulb,
  locate: LocateFixed,
  lock: Lock,
  logout: LogOut,
  mail: Mail,
  map: Map,
  mapPin: MapPin,
  message: MessageSquare,
  money: CircleDollarSign,
  more: Ellipsis,
  navigation: Navigation,
  package: Package,
  palette: Palette,
  party: PartyPopper,
  pencil: Pencil,
  phone: Phone,
  plane: Plane,
  plus: Plus,
  receipt: ReceiptText,
  repeat: Repeat2,
  rotate: RotateCw,
  save: Save,
  scan: ScanLine,
  scanText: ScanText,
  search: Search,
  send: Send,
  settings: Settings,
  share: Share2,
  shield: ShieldCheck,
  shoppingBag: ShoppingBag,
  shoppingCart: ShoppingCart,
  sparkles: Sparkles,
  square: Square,
  star: Star,
  sun: Sun,
  target: Target,
  timer: Timer,
  trash: Trash,
  trendDown: TrendingDown,
  trendUp: TrendingUp,
  user: User,
  userPlus: UserPlus,
  users: Users,
  utensils: Utensils,
  wallet: Wallet,
  wand: WandSparkles,
  whatsapp: MessageCircle,
  x: X,
} as const;

export type IconName = keyof typeof ICONS;

// Acepta un nombre semántico o un emoji heredado (datos ya guardados).
export function normalizeIconName(value: string | undefined, fallback: IconName = 'mapPin'): IconName {
  if (!value) return fallback;
  if (Object.prototype.hasOwnProperty.call(ICONS, value)) return value as IconName;
  const legacy: Record<string, IconName> = {
    '💰': 'money',
    '🏪': 'money',
    '👥': 'users',
    '👤': 'user',
    '✅': 'checkSquare',
    '✓': 'check',
    '✔️': 'check',
    '⏱️': 'timer',
    '🕐': 'clock',
    '🔁': 'repeat',
    '🔄': 'repeat',
    '🎯': 'target',
    '📅': 'calendar',
    '🗓️': 'calendar',
    '🔍': 'search',
    '🔔': 'bell',
    '☀️': 'sun',
    '📍': 'mapPin',
    '🧾': 'receipt',
    '📷': 'camera',
    '📝': 'fileText',
    '🤖': 'brain',
    '💡': 'lightbulb',
    '🧭': 'compass',
    '📞': 'phone',
    '💬': 'whatsapp',
    '✉️': 'mail',
    '🎉': 'party',
    '🛟': 'lifeBuoy',
    '💼': 'briefcase',
    '🏠': 'home',
    '⭐': 'star',
    '★': 'star',
    '📦': 'package',
    '🤝': 'handshake',
    '🍽️': 'utensils',
    '🍳': 'utensils',
    '🛍️': 'shoppingBag',
    '🏋️': 'dumbbell',
    '📚': 'book',
    '✈️': 'plane',
    '❤️': 'heart',
    '♡': 'heart',
    '📌': 'mapPin',
    '⬜': 'square',
    '⏳': 'hourglass',
    '●': 'circle',
  };
  return legacy[value] ?? fallback;
}

export function contactIconName(category: string): IconName {
  const map: Record<string, IconName> = {
    Amigos: 'star',
    Clientes: 'briefcase',
    Proveedores: 'package',
    Familia: 'home',
    Compañeros: 'users',
    Otros: 'mapPin',
  };
  return map[category] ?? 'mapPin';
}

export function placeIconName(category: string): IconName {
  const map: Record<string, IconName> = {
    Casa: 'home',
    Trabajo: 'briefcase',
    Cliente: 'handshake',
    Restaurante: 'utensils',
    Compras: 'shoppingBag',
    Gimnasio: 'dumbbell',
    Estudio: 'book',
    Amigos: 'users',
  };
  return map[category] ?? 'mapPin';
}

export function goalIconName(value: string): IconName {
  const map: Record<string, IconName> = {
    ingresos: 'money',
    contactos: 'users',
    tareas: 'checkSquare',
    horas: 'timer',
    veces: 'repeat',
  };
  return map[value] ?? normalizeIconName(value, 'target');
}

export function eventIconName(type: string): IconName {
  if (type === 'Reunión') return 'users';
  if (type === 'Personal') return 'home';
  if (type === 'Trabajo') return 'briefcase';
  if (type === 'Comida') return 'utensils';
  return 'calendar';
}

export function templateIconName(value: string): IconName {
  return normalizeIconName(value, 'mapPin');
}

export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = 2,
  style,
}: {
  name: string;
  size?: number;
  color?: ColorValue;
  strokeWidth?: number;
  style?: any;
}) {
  const colors = useThemeColors();
  const Cmp = ICONS[normalizeIconName(name)];
  return <Cmp size={size} color={color ?? colors.text} strokeWidth={strokeWidth} style={style} />;
}
