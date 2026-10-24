import { supabase } from '@/lib/supabaseClient';
import { bookingService } from '@/lib/services/bookingService';
import { googleRatingsService } from '@/lib/services/googleRatingsService';
import { getCurrentISTDateStr } from '@/lib/billing';
import { getGoogleMapsDirectionsUrl, calculateDistanceKm, formatDistance } from '@/lib/utils/locationUtils';
import { resolveBusinessConfig, inspectOperatingHours } from '@/lib/utils/operatingDayUtils';

export interface ClubDiscoveryQuery {
  locationQuery?: string;
  gameType?: 'pool' | 'snooker' | 'ps5' | string;
  dateStr?: string;
  startTime?: string;
  durationMins?: number;
  maxBudgetPerHour?: number;
  customerPhone?: string;
  customerLat?: number;
  customerLng?: number;
}

export interface ClubRecommendation {
  businessId: string;
  businessName: string;
  address: string;
  contactNumber: string;
  matchedGameType: string;
  availableGames: string[];
  tablesCount: number;
  availableSlotCount: number;
  sampleAvailableSlots: string[];
  ratePerHour: number;
  pricingBreakdown: Record<string, number>;
  operatingHours: string;
  directionsUrl: string | null;
  recommendationReason: string;
  isAvailableForRequestedTime?: boolean;
  distanceKm?: number | null;
  distanceDisplay?: string | null;
  googleRating?: number | null;
  googleReviewCount?: number | null;
  googleRatingDisplay?: string | null;
}

export const clubDiscoveryService = {
  /**
   * Discovers and ranks eligible verified partner clubs across the QControl centralized network.
   * Supports geo-distance ranking when customer coordinates are provided.
   */
  async discoverAndRankClubs(query: ClubDiscoveryQuery): Promise<ClubRecommendation[]> {
    const {
      locationQuery = '',
      gameType = 'pool',
      dateStr = getCurrentISTDateStr(),
      startTime,
      durationMins = 60,
      maxBudgetPerHour,
      customerLat,
      customerLng,
    } = query;

    const normLocation = locationQuery.toLowerCase().trim();
    const normGame = (gameType || 'pool').toLowerCase().trim();

    // 1. Fetch active and approved partner clubs from database
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('*')
      .or('status.eq.APPROVED,status.eq.ACTIVE');

    if (error || !businesses || businesses.length === 0) {
      console.error('Error fetching businesses for club discovery:', error);
      return [];
    }

    // Filter out archived, pending, suspended, or clubs without authorized WhatsApp AI entitlement
    const activeClubs = businesses.filter(b => {
      if ((b.business_name || '').toLowerCase().includes('archived')) return false;
      if (!b.tables || b.tables.length === 0) return false;

      const bStatus = (b.status || '').toUpperCase().trim();
      if (bStatus !== 'APPROVED' && bStatus !== 'ACTIVE') return false;

      // Enforce developer-controlled WhatsApp AI entitlement
      const ents = b.feature_entitlements || b.qpulse_config?.feature_entitlements || {};
      const hasConfig = Object.keys(ents).length > 0;
      if (hasConfig && !ents.whatsapp_ai) return false;
      if (!hasConfig && bStatus !== 'ACTIVE') return false;

      return true;
    });


    // Evaluate active clubs concurrently for fast response times
    const evalPromises = activeClubs.map(async (b) => {
      const tables = b.tables || [];
      if (tables.length === 0) return null;

      // Extract unique games supported by this club
      const availableGames = Array.from(new Set(
        tables.map((t: any) => ((t.game_type || t.type || 'pool') as string).toLowerCase())
      )).map(g => g === 'msnooker' ? 'snooker' : g);

      // Filter tables by requested game type
      const matchingTables = tables.filter((t: any) => {
        const type = ((t as any).game_type || (t as any).type || 'pool').toLowerCase();
        if (normGame === 'snooker') return type === 'snooker' || type === 'msnooker';
        return type === normGame;
      });

      // If club has tables for requested game, evaluate
      if (matchingTables.length === 0 && normGame) return null;

      // Compute pricing breakdown for all games offered
      const pricingBreakdown: Record<string, number> = {};
      const allRules = b.pricing_rules?.rules || {};
      for (const game of ['pool', 'snooker', 'ps5']) {
        const rule = allRules[game] || {};
        pricingBreakdown[game] = Number(rule.rate || rule.baseRatePerHour || (rule.type === 'time_based' ? rule.evening_rate : 200)) || 200;
      }

      const ratePerHour = pricingBreakdown[normGame] || 200;

      // If budget specified and exceeds, skip
      if (maxBudgetPerHour && ratePerHour > maxBudgetPerHour) {
        return null;
      }

      // Check slot availability
      const availableSlots = await bookingService.getAvailableSlots(b.id, normGame, dateStr, durationMins);

      let isAvailableForRequestedTime = false;
      if (startTime) {
        const normStart = startTime.trim().substring(0, 5);
        if (availableSlots.some(s => s.time === normStart)) {
          isAvailableForRequestedTime = true;
        } else {
          const reqParts = startTime.split(':');
          const reqStartMins = parseInt(reqParts[0], 10) * 60 + parseInt(reqParts[1], 10);
          for (const t of matchingTables) {
            const check = await bookingService.checkTableAvailability(b.id, t.id, dateStr, reqStartMins, durationMins);
            if (check.available) {
              isAvailableForRequestedTime = true;
              break;
            }
          }
        }
      }

      // Calculate geo-distance if customer coordinates provided
      let distanceKm: number | null = null;
      let distanceDisplay: string | null = null;
      if (
        customerLat !== undefined && customerLng !== undefined &&
        b.latitude !== null && b.longitude !== null &&
        b.latitude !== undefined && b.longitude !== undefined
      ) {
        distanceKm = calculateDistanceKm(customerLat, customerLng, Number(b.latitude), Number(b.longitude));
        distanceDisplay = formatDistance(distanceKm);
      }

      // Google rating (use cached DB values for performance)
      let googleRating: number | null = b.google_rating !== null ? Number(b.google_rating) : null;
      let googleReviewCount: number | null = b.google_review_count || null;
      let googleRatingDisplay: string | null = null;

      if (googleRating !== null && googleRating > 0) {
        const stars = '⭐'.repeat(Math.round(googleRating));
        googleRatingDisplay = `${stars} ${googleRating.toFixed(1)}/5${googleReviewCount ? ` (${googleReviewCount} reviews)` : ''}`;
      }

      // Determine location match score and reason
      const address = b.address || '';
      const bName = b.business_name || '';
      const fullText = `${bName} ${address}`.toLowerCase();

      let isLocationMatch = false;
      if (normLocation) {
        isLocationMatch = fullText.includes(normLocation) || normLocation.includes(bName.toLowerCase());
      }

      let recommendationReason = 'Verified partner club';
      if (distanceKm !== null && distanceKm < 3) {
        recommendationReason = `${distanceDisplay} — Closest to you`;
      } else if (isLocationMatch) {
        recommendationReason = `Top match in ${normLocation.toUpperCase()}`;
      } else if (isAvailableForRequestedTime) {
        recommendationReason = `Available at requested time (${startTime})`;
      } else if (ratePerHour <= 180) {
        recommendationReason = `Lowest-priced table (₹${ratePerHour}/hr)`;
      } else if (availableSlots.length > 5) {
        recommendationReason = 'High table availability today';
      }

      const directionsUrl = getGoogleMapsDirectionsUrl({
        address: b.address,
        businessName: b.business_name,
        latitude: b.latitude,
        longitude: b.longitude,
      });

      // Genuine operating hours
      const bConfig = resolveBusinessConfig(b);
      const bHoursSummary = inspectOperatingHours(bConfig);
      const operatingHours = `${bHoursSummary.openTimeFormatted} – ${bHoursSummary.closeTimeFormatted}`;

      return {
        businessId: b.id,
        businessName: b.business_name,
        address: b.address || 'Address on request',
        contactNumber: b.contact_number || '',
        matchedGameType: normGame,
        availableGames: Array.from(new Set(availableGames)).map(g => (g as string).toUpperCase()),
        tablesCount: matchingTables.length || tables.length,
        availableSlotCount: availableSlots.length,
        sampleAvailableSlots: availableSlots.slice(0, 4).map(s => s.time),
        ratePerHour,
        pricingBreakdown,
        operatingHours,
        directionsUrl,
        recommendationReason,
        isAvailableForRequestedTime,
        distanceKm,
        distanceDisplay,
        googleRating,
        googleReviewCount,
        googleRatingDisplay,
      } as ClubRecommendation;
    });

    const evaluatedResults = await Promise.all(evalPromises);
    const recommendations: ClubRecommendation[] = evaluatedResults.filter((r): r is ClubRecommendation => r !== null);

    // Rank recommendations:
    // 1. Closest distance (if geo-coordinates available)
    // 2. Matches requested time
    // 3. Matches location query
    // 4. Lowest rate
    // 5. Most available slots
    recommendations.sort((a, b) => {
      // Distance-first sort when geo is available
      if (typeof a.distanceKm === 'number' && typeof b.distanceKm === 'number') {
        if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      } else if (typeof a.distanceKm === 'number') {
        return -1;
      } else if (typeof b.distanceKm === 'number') {
        return 1;
      }

      if (a.isAvailableForRequestedTime && !b.isAvailableForRequestedTime) return -1;
      if (!a.isAvailableForRequestedTime && b.isAvailableForRequestedTime) return 1;

      if (normLocation) {
        const aLoc = a.address.toLowerCase().includes(normLocation) || a.businessName.toLowerCase().includes(normLocation);
        const bLoc = b.address.toLowerCase().includes(normLocation) || b.businessName.toLowerCase().includes(normLocation);
        if (aLoc && !bLoc) return -1;
        if (!aLoc && bLoc) return 1;
      }

      if (a.ratePerHour !== b.ratePerHour) {
        return a.ratePerHour - b.ratePerHour;
      }

      return b.availableSlotCount - a.availableSlotCount;
    });

    return recommendations;
  },

  /**
   * Discovers nearby clubs using customer GPS coordinates.
   * Coordinates are used ephemerally and never persisted.
   */
  async discoverNearbyClubs(
    customerLat: number,
    customerLng: number,
    maxDistanceKm: number = 25,
    gameType: string = 'pool'
  ): Promise<ClubRecommendation[]> {
    const all = await this.discoverAndRankClubs({
      gameType,
      customerLat,
      customerLng,
    });

    // Filter by max distance
    return all.filter(c => typeof c.distanceKm === 'number' && c.distanceKm <= maxDistanceKm);
  },
};
