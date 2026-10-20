import { supabase } from '@/lib/supabaseClient';
import { bookingService } from '@/lib/services/bookingService';
import { getCurrentISTDateStr } from '@/lib/billing';

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
  tablesCount: number;
  availableSlotCount: number;
  sampleAvailableSlots: string[];
  ratePerHour: number;
  recommendationReason: string;
  isAvailableForRequestedTime?: boolean;
}

// Known localities and coordinates in Pune for distance estimation when coordinates are provided
const PUNE_LOCALITIES: Record<string, { lat: number; lng: number }> = {
  'kothrud': { lat: 18.5074, lng: 73.8077 },
  'baner': { lat: 18.5590, lng: 73.7868 },
  'fc road': { lat: 18.5246, lng: 73.8415 },
  'deccan': { lat: 18.5167, lng: 73.8417 },
  'viman nagar': { lat: 18.5679, lng: 73.9143 },
  'wakad': { lat: 18.5987, lng: 73.7684 },
  'camp': { lat: 18.5186, lng: 73.8793 },
  'pune': { lat: 18.5204, lng: 73.8567 },
};

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export const clubDiscoveryService = {
  /**
   * Discovers and ranks eligible partner clubs across the QControl centralized network.
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

    // 1. Fetch all active partner clubs from database
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('id, business_name, address, contact_number, tables, pricing_rules, status')
      .eq('status', 'ACTIVE');

    if (error || !businesses || businesses.length === 0) {
      console.error('Error fetching businesses for club discovery:', error);
      return [];
    }

    const recommendations: ClubRecommendation[] = [];

    for (const b of businesses) {
      const tables = b.tables || [];
      if (tables.length === 0) continue;

      // Filter tables by requested game type
      const matchingTables = tables.filter((t: any) => {
        const type = ((t as any).game_type || (t as any).type || 'pool').toLowerCase();
        if (normGame === 'snooker') return type === 'snooker' || type === 'msnooker';
        return type === normGame;
      });

      if (matchingTables.length === 0) continue;

      // Compute rate per hour from pricing_rules
      const rules = b.pricing_rules?.rules?.[normGame] || {};
      const ratePerHour = Number(rules.rate || rules.baseRatePerHour || (rules.type === 'time_based' ? rules.evening_rate : 200)) || 200;

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
        // Check for direct match or substring
        isLocationMatch = fullText.includes(normLocation) || normLocation.includes(bName.toLowerCase());
      }

      let recommendationReason = 'Available club';
      if (isLocationMatch) {
        recommendationReason = `Closest available club in ${normLocation.toUpperCase()}`;
      } else if (isAvailableForRequestedTime) {
        recommendationReason = `Available at requested time (${startTime})`;
      } else if (ratePerHour <= 180) {
        recommendationReason = `Lowest-priced available table (₹${ratePerHour}/hr)`;
      } else if (availableSlots.length > 5) {
        recommendationReason = 'High table availability today';
      }

      recommendations.push({
        businessId: b.id,
        businessName: b.business_name,
        address: b.address || 'Address on request',
        contactNumber: b.contact_number || '',
        matchedGameType: normGame,
        tablesCount: matchingTables.length,
        availableSlotCount: availableSlots.length,
        sampleAvailableSlots: availableSlots.slice(0, 4).map(s => s.time),
        ratePerHour,
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
