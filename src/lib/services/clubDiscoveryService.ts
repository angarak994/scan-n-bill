import { supabase } from '@/lib/supabaseClient';
import { bookingService } from '@/lib/services/bookingService';
import { getCurrentISTDateStr } from '@/lib/billing';
import { getGoogleMapsDirectionsUrl } from '@/lib/utils/locationUtils';

export interface ClubDiscoveryQuery {
  locationQuery?: string;
  gameType?: 'pool' | 'snooker' | 'ps5' | string;
  dateStr?: string;
  startTime?: string;
  durationMins?: number;
  maxBudgetPerHour?: number;
  customerPhone?: string;
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
}

export const clubDiscoveryService = {
  /**
   * Discovers and ranks eligible verified partner clubs across the QControl centralized network.
   */
  async discoverAndRankClubs(query: ClubDiscoveryQuery): Promise<ClubRecommendation[]> {
    const {
      locationQuery = '',
      gameType = 'pool',
      dateStr = getCurrentISTDateStr(),
      startTime,
      durationMins = 60,
      maxBudgetPerHour,
    } = query;

    const normLocation = locationQuery.toLowerCase().trim();
    const normGame = (gameType || 'pool').toLowerCase().trim();

    // 1. Fetch active partner clubs from database
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('id, business_name, address, contact_number, tables, pricing_rules, status')
      .eq('status', 'ACTIVE');

    if (error || !businesses || businesses.length === 0) {
      console.error('Error fetching businesses for club discovery:', error);
      return [];
    }

    const recommendations: ClubRecommendation[] = [];

    // Filter out archived or demo test clubs
    const activeClubs = businesses.filter(b => 
      !b.business_name.toLowerCase().includes('archived') &&
      b.tables && b.tables.length > 0
    );

    for (const b of activeClubs) {
      const tables = b.tables || [];
      if (tables.length === 0) continue;

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
      if (matchingTables.length === 0 && normGame) continue;

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
        continue;
      }

      // Check slot availability
      const availableSlots = await bookingService.getAvailableSlots(b.id, normGame, dateStr, durationMins);

      let isAvailableForRequestedTime = false;
      if (startTime) {
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

      // Determine location match score and reason
      const address = b.address || '';
      const bName = b.business_name || '';
      const fullText = `${bName} ${address}`.toLowerCase();

      let isLocationMatch = false;
      if (normLocation) {
        isLocationMatch = fullText.includes(normLocation) || normLocation.includes(bName.toLowerCase());
      }

      let recommendationReason = 'Verified partner club';
      if (isLocationMatch) {
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
        businessName: b.business_name
      });

      recommendations.push({
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
        operatingHours: '11:00 AM – 11:30 PM',
        directionsUrl,
        recommendationReason,
        isAvailableForRequestedTime
      });
    }

    // Rank recommendations:
    // 1. Matches requested time
    // 2. Matches location query
    // 3. Lowest rate
    // 4. Most available slots
    recommendations.sort((a, b) => {
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
  }
};
