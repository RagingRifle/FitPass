import React from 'react';
import type { ColorValue, StyleProp, TextStyle } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

type Props = { size?: number; color?: ColorValue; fill?: string; strokeWidth?: number; style?: StyleProp<TextStyle> };
const iconNames = {
  Activity: 'pulse', AlertCircle: 'alert-circle-outline', AlertTriangle: 'alert-outline', Apple: 'food-apple-outline',
  ArrowDown: 'arrow-down', ArrowDownRight: 'arrow-bottom-right', ArrowUp: 'arrow-up', ArrowUpRight: 'arrow-top-right',
  ArrowLeft: 'arrow-left', ArrowRight: 'arrow-right', Award: 'medal-outline', BadgeCheck: 'check-decagram-outline',
  Building2: 'domain', Calendar: 'calendar-month-outline', CalendarCheck: 'calendar-check-outline', Camera: 'camera-outline', Check: 'check',
  BarChart2: 'chart-bar', BarChart3: 'chart-bar', Building: 'office-building-outline', CheckCircle: 'check-circle-outline', CheckCircle2: 'check-circle',
  ChevronDown: 'chevron-down', ChevronLeft: 'chevron-left',
  ChevronRight: 'chevron-right', Circle: 'circle-outline', Clock: 'clock-outline', CreditCard: 'credit-card-outline',
  Clipboard: 'clipboard-outline', ClipboardList: 'clipboard-list-outline', DollarSign: 'currency-usd', Download: 'download-outline',
  Droplet: 'water-outline', Droplets: 'water', Dumbbell: 'dumbbell', Edit2: 'pencil-outline', Edit3: 'pencil-outline', Eye: 'eye-outline', EyeOff: 'eye-off-outline',
  FileText: 'file-document-outline', Filter: 'filter-variant', Flame: 'fire',
  Globe: 'web', History: 'history', Info: 'information-outline', LayoutDashboard: 'view-dashboard-outline', LayoutGrid: 'view-grid-outline',
  Key: 'key-outline', Layers: 'layers-outline', LifeBuoy: 'lifebuoy', Lock: 'lock-outline', LogIn: 'login', LogOut: 'logout', Mail: 'email-outline', MapPin: 'map-marker-outline',
  MessageSquare: 'message-text-outline', MessageSquarePlus: 'message-plus-outline', Minus: 'minus', Package: 'package-variant-closed', PackageCheck: 'package-variant-closed-check',
  PieChart: 'chart-pie', Pencil: 'pencil-outline', Phone: 'phone-outline', Play: 'play', Plus: 'plus', PlusCircle: 'plus-circle-outline', QrCode: 'qrcode',
  RefreshCw: 'refresh', RotateCcw: 'reload', RotateCw: 'refresh', Scale: 'scale-balance', Scan: 'line-scan', ScanLine: 'line-scan', Search: 'magnify', Send: 'send-outline',
  Settings: 'cog-outline', Share2: 'share-variant', ShieldAlert: 'shield-alert-outline', ShieldCheck: 'shield-check-outline', Shuffle: 'shuffle-variant', Snowflake: 'snowflake', Sparkles: 'creation-outline', Star: 'star-outline', Sun: 'weather-sunny',
  Target: 'bullseye-arrow', Ticket: 'ticket-outline', Trash2: 'trash-can-outline', TrendingDown: 'trending-down', TrendingUp: 'trending-up', Trophy: 'trophy-outline', Utensils: 'silverware-fork-knife', User: 'account-outline',
  UserCheck: 'account-check-outline', UserCog: 'account-cog-outline', UserMinus: 'account-minus-outline', UserPlus: 'account-plus-outline', Users: 'account-group-outline', Wallet: 'wallet-outline', Wrench: 'wrench-outline',
  X: 'close', XCircle: 'close-circle-outline', Zap: 'lightning-bolt',
};

function makeIcon(name: keyof typeof iconNames) {
  return function AppIcon({ size = 24, color = '#243447', fill, style }: Props) {
    const glyph = name === 'Star' && fill ? 'star' : iconNames[name];
    return <MaterialDesignIcons name={glyph as any} size={size} color={color as any} style={style} />;
  };
}

export const {
  Activity, AlertCircle, AlertTriangle, Apple, ArrowDown, ArrowDownRight, ArrowUp, ArrowUpRight, ArrowLeft, ArrowRight, Award, BadgeCheck, BarChart2, BarChart3, Building, Building2, Calendar, CalendarCheck,
  Camera, Check, CheckCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, Clock, CreditCard, DollarSign, Download,
  Clipboard, ClipboardList, Droplet, Droplets, Dumbbell, Edit2, Edit3, Eye, EyeOff, FileText, Filter, Flame, Globe, History, Info, Key, LayoutDashboard, LayoutGrid, Layers, LifeBuoy,
  Lock, LogIn, LogOut, Mail, MapPin, MessageSquare, MessageSquarePlus, Minus, Package, PackageCheck, PieChart, Pencil, Phone, Play, Plus, PlusCircle, QrCode, RefreshCw, RotateCcw, RotateCw,
  Scale, Scan, ScanLine, Search, Send, Settings, Share2, ShieldAlert, ShieldCheck, Shuffle, Snowflake, Sparkles, Star, Sun, Target, Ticket, Trash2, TrendingDown, TrendingUp, Trophy, Utensils, User,
  UserCheck, UserCog, UserMinus, UserPlus, Users, Wallet, Wrench, X, XCircle, Zap,
} = Object.fromEntries(Object.keys(iconNames).map((key) => [key, makeIcon(key as keyof typeof iconNames)])) as Record<keyof typeof iconNames, React.ComponentType<Props>>;
