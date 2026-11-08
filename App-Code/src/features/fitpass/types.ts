// FitPass member feature types
// AGENTS.md §4 — feature folder types file

export interface SessionStatus {
  sessionsRemaining: number;
  sessionsTotal: number;
  fitpassCoins: number;
  coinsPerSession?: number;
  displayCoins?: boolean;
  displayCheckIns?: boolean;
  currentSessionEndsAt: string | null;
  currentSessionGymId: string | null;
  cooldownEndsAt: string | null;
  planName: string | null;
  expiryDate: string | null;
  planStatus: 'Active' | 'Expired' | 'Inactive';
}

export interface CheckInHistoryItem {
  id: string;
  _id?: string;
  gymId: string;
  gymName: string;
  branchId?: string | null;
  branchName?: string | null;
  startedAt: string;
  endedAt?: string | null;
  status: 'Active' | 'Completed' | 'Expired';
  sessionsDeducted?: number;
  date?: string;
  checkInTime?: string;
}

export interface PartnerGymBranch {
  id: string;
  _id?: string;
  name: string;
  address?: string;
  phone?: string;
  fitPassEnabled?: boolean;
}

export interface GymReview {
  id: string;
  gymId: string;
  memberId: string;
  memberName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface PartnerGym {
  id: string;
  _id?: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  images?: string[];
  rating?: number;
  averageRating?: number;
  totalReviews?: number;
  reviews?: GymReview[];
  amenities?: string[];
  operatingHours?: string;
  description?: string;
  activeSessions?: number;
  defaultSessionDurationMinutes?: number;
  status?: string;
  isBranch?: boolean;
  branchId?: string;
  gymId?: string;
  parentGymName?: string;
  branches?: PartnerGymBranch[];
}

export interface GymDiscoveryProfile {
  id: string;
  gymId: string;
  shortDescription?: string;
  description?: string;
  coverImageUrl?: string;
  logoUrl?: string;
  ownerName?: string;
  contactNumber?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
  landmarks?: string[];
  openingTime?: string;
  closingTime?: string;
  workingDays?: string[];
  timeZone?: string;
  weeklySchedule?: Record<string, { closed?: boolean; open?: string; close?: string }>;
  scheduleExceptions?: Array<{ date: string; closed: boolean; open?: string; close?: string; reason?: string }>;
  todayHours?: { date: string; day?: string; closed: boolean; open?: string; close?: string; reason?: string; isException?: boolean };
  hasParking?: boolean;
  hasLockers?: boolean;
  hasShowers?: boolean;
  hasPersonalTraining?: boolean;
  hasGroupClasses?: boolean;
  isWomenFriendly?: boolean;
  isAc?: boolean;
  amenities?: string[];
  equipments?: string[];
  instagram?: string;
  facebook?: string;
  youtube?: string;
  status?: string;
  rejectionReason?: string;
  isVerified?: boolean;
  rating?: number;
  reviewCount?: number;
  viewCount?: number;
  isOpenNow?: boolean;
  distanceKm?: number | null;
  totalVisits?: number;
}

export interface GymPost {
  id: string;
  gymId: string;
  title: string;
  caption?: string;
  description?: string;
  images?: string[];
  videoUrl?: string;
  status?: string;
  viewsCount?: number;
  createdByName?: string;
  createdAt: string;
  gym?: {
    id: string;
    name: string;
    discoveryProfile?: {
      logoUrl?: string;
      coverImageUrl?: string;
      city?: string;
      isVerified?: boolean;
    };
  };
}

export interface DiscoveryGymItem {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  status?: string;
  discoveryProfile: GymDiscoveryProfile;
}

export interface FitPassPlan {
  id: string;
  _id?: string;
  name: string;
  duration: number;
  durationUnit: string;
  sessions: number;
  price: number;
  gymId: string;
}

export interface FitPassDashboardData {
  sessionStatus: SessionStatus;
  recentHistory: CheckInHistoryItem[];
  partnerGymsCount: number;
}
