import { supabase } from '@/lib/supabaseClient';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface GoogleRating {
  rating: number | null;
  reviewCount: number | null;
  placeId: string | null;
  isStale: boolean;
  lastUpdated: string | null;
}

export const googleRatingsService = {
  /**
   * Fetches Google rating for a business. Uses cached DB value if fresh,
   * otherwise fetches from Google Places API and updates cache.
   * Never invents ratings — returns null with clear indicator if unavailable.
   */
  async getRating(businessId: string): Promise<GoogleRating> {
    // 1. Check cached value in businesses table
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .maybeSingle();

    if (!business) {
      return { rating: null, reviewCount: null, placeId: null, isStale: true, lastUpdated: null };
    }

    const cachedAt = business.google_rating_updated_at ? new Date(business.google_rating_updated_at).getTime() : 0;
    const isFresh = (Date.now() - cachedAt) < CACHE_DURATION_MS;

    // Return cached if fresh
    if (isFresh && business.google_rating !== null) {
      return {
        rating: Number(business.google_rating),
        reviewCount: business.google_review_count,
        placeId: business.google_place_id,
        isStale: false,
        lastUpdated: business.google_rating_updated_at,
      };
    }

    // 2. If no API key, return cached or null
    if (!GOOGLE_PLACES_API_KEY) {
      if (business.google_rating !== null) {
        return {
          rating: Number(business.google_rating),
          reviewCount: business.google_review_count,
          placeId: business.google_place_id,
          isStale: true,
          lastUpdated: business.google_rating_updated_at,
        };
      }
      return { rating: null, reviewCount: null, placeId: null, isStale: true, lastUpdated: null };
    }

    // 3. Fetch from Google Places API
    try {
      let placeId = business.google_place_id;

      // If no place_id, try to find via Text Search
      if (!placeId) {
        const searchQuery = `${business.business_name} ${business.address || ''}`.trim();
        placeId = await this.findPlaceId(searchQuery);
      }

      if (!placeId) {
        return { rating: null, reviewCount: null, placeId: null, isStale: true, lastUpdated: null };
      }

      // Fetch place details for rating
      const details = await this.fetchPlaceDetails(placeId);

      if (details) {
        // Update cache in DB
        await supabase
          .from('businesses')
          .update({
            google_place_id: placeId,
            google_rating: details.rating,
            google_review_count: details.reviewCount,
            google_rating_updated_at: new Date().toISOString(),
          })
          .eq('id', businessId);

        return {
          rating: details.rating,
          reviewCount: details.reviewCount,
          placeId,
          isStale: false,
          lastUpdated: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.error('Google Places API error:', err);
    }

    // Return stale cached or null
    if (business.google_rating !== null) {
      return {
        rating: Number(business.google_rating),
        reviewCount: business.google_review_count,
        placeId: business.google_place_id,
        isStale: true,
        lastUpdated: business.google_rating_updated_at,
      };
    }

    return { rating: null, reviewCount: null, placeId: null, isStale: true, lastUpdated: null };
  },

  /**
   * Finds a Google Place ID using the Places Text Search API.
   */
  async findPlaceId(query: string): Promise<string | null> {
    if (!GOOGLE_PLACES_API_KEY || !query.trim()) return null;

    try {
      const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${GOOGLE_PLACES_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK' && data.candidates?.length > 0) {
        return data.candidates[0].place_id;
      }
    } catch (err) {
      console.error('Google Places findPlace error:', err);
    }

    return null;
  },

  /**
   * Fetches place details (rating, review count) from Google Places API.
   */
  async fetchPlaceDetails(placeId: string): Promise<{ rating: number; reviewCount: number } | null> {
    if (!GOOGLE_PLACES_API_KEY || !placeId) return null;

    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,user_ratings_total&key=${GOOGLE_PLACES_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK' && data.result) {
        return {
          rating: data.result.rating || 0,
          reviewCount: data.result.user_ratings_total || 0,
        };
      }
    } catch (err) {
      console.error('Google Places details error:', err);
    }

    return null;
  },

  /**
   * Batch refresh ratings for all businesses (used by cron).
   */
  async refreshAllRatings(): Promise<{ updated: number; failed: number }> {
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, google_place_id, business_name, address')
      .eq('status', 'ACTIVE');

    let updated = 0;
    let failed = 0;

    for (const biz of businesses || []) {
      try {
        const result = await this.getRating(biz.id);
        if (result.rating !== null && !result.isStale) {
          updated++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return { updated, failed };
  },

  /**
   * Formats a Google rating for display in WhatsApp messages.
   */
  formatRatingDisplay(rating: GoogleRating): string {
    if (rating.rating === null) {
      return '⭐ *Google Rating:* Not available';
    }

    const stars = '⭐'.repeat(Math.round(rating.rating));
    const staleNote = rating.isStale ? ' _(cached)_' : '';
    const reviewNote = rating.reviewCount ? ` (${rating.reviewCount} reviews)` : '';

    return `${stars} *Google Rating:* ${rating.rating.toFixed(1)}/5${reviewNote}${staleNote}`;
  },
};
