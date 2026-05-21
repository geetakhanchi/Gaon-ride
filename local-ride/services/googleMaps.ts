// ─── Google Maps Service Layer ────────────────────────────────────────────────
// Covers: Places Autocomplete, Geocoding, Directions, Distance Matrix

// ── India bounding box ───────────────────────────────────────────────────────
// Used to reject simulator/emulator fake GPS locations (e.g. Cupertino, CA)
const INDIA_BOUNDS = { minLat: 6.0, maxLat: 37.6, minLng: 68.1, maxLng: 97.4 };
export const isWithinIndia = (lat: number, lng: number): boolean =>
    lat >= INDIA_BOUNDS.minLat && lat <= INDIA_BOUNDS.maxLat &&
    lng >= INDIA_BOUNDS.minLng && lng <= INDIA_BOUNDS.maxLng;

// Default fallback centre (Panipat, Haryana)
export const INDIA_FALLBACK = { latitude: 29.3909, longitude: 76.9635 };

export const getApiKey = (): string | null => {
    const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key || key === 'YOUR_API_KEY_HERE' || key.startsWith('${')) {
        console.warn('[GoogleMaps] API key missing or invalid. Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to .env');
        return null;
    }
    return key;
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface PlacePrediction {
    placeId: string;
    description: string;
    mainText: string;
    secondaryText: string;
}

export interface PlaceDetail {
    placeId: string;
    name: string;
    formattedAddress: string;
    lat: number;
    lng: number;
}

export interface DistanceMatrixResult {
    distanceText: string;
    distanceValue: number;   // metres
    durationText: string;
    durationValue: number;   // seconds
}

export interface RouteStep {
    instruction: string;
    distance: string;
    duration: string;
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
}

export interface DirectionsResult {
    polylineEncoded: string;
    distanceText: string;
    distanceValue: number;
    durationText: string;
    durationValue: number;
    steps: RouteStep[];
    startAddress: string;
    endAddress: string;
    bounds: {
        northeast: { lat: number; lng: number };
        southwest: { lat: number; lng: number };
    };
}

export interface GeocodedLocation {
    lat: number;
    lng: number;
    formattedAddress: string;
    locality: string;
    subLocality: string;
}

// ── 1. Places Autocomplete ───────────────────────────────────────────────────

export const fetchPlacePredictions = async (
    query: string,
    sessionToken?: string,
): Promise<PlacePrediction[]> => {
    const key = getApiKey();
    if (!key || !query.trim()) return [];
    try {
        let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json`
            + `?input=${encodeURIComponent(query)}`
            + `&components=country:in`
            + `&region=in`
            + `&language=en`
            + `&key=${key}`;
        if (sessionToken) url += `&sessiontoken=${sessionToken}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.predictions) {
            return data.predictions.map((p: any) => ({
                placeId: p.place_id,
                description: p.description,
                mainText: p.structured_formatting?.main_text ?? p.description,
                secondaryText: p.structured_formatting?.secondary_text ?? '',
            }));
        }
        return [];
    } catch (e) {
        console.error('[Places Autocomplete]', e);
        return [];
    }
};

// Legacy alias kept for booking.tsx compatibility
export const fetchGooglePlaces = async (query: string): Promise<string[]> => {
    const preds = await fetchPlacePredictions(query);
    return preds.map(p => p.description);
};

// ── 2. Place Details (lat/lng from placeId) ──────────────────────────────────

export const fetchPlaceDetails = async (placeId: string): Promise<PlaceDetail | null> => {
    const key = getApiKey();
    if (!key) return null;
    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json`
            + `?place_id=${encodeURIComponent(placeId)}`
            + `&fields=place_id,name,formatted_address,geometry`
            + `&key=${key}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.result) {
            const r = data.result;
            return {
                placeId: r.place_id,
                name: r.name,
                formattedAddress: r.formatted_address,
                lat: r.geometry.location.lat,
                lng: r.geometry.location.lng,
            };
        }
        return null;
    } catch (e) {
        console.error('[Place Details]', e);
        return null;
    }
};

// ── 3. Reverse Geocoding (lat/lng → address) ─────────────────────────────────

export const reverseGeocode = async (
    lat: number,
    lng: number,
): Promise<GeocodedLocation | null> => {
    const key = getApiKey();
    if (!key) return null;
    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json`
            + `?latlng=${lat},${lng}`
            + `&result_type=street_address|sublocality|locality|route`
            + `&key=${key}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.results.length > 0) {
            // Pick the most specific result that has a street-level address
            const best = data.results[0];

            const get = (type: string): string => {
                for (const r of data.results) {
                    const comp = (r.address_components ?? []).find((c: any) => c.types.includes(type));
                    if (comp) return comp.long_name;
                }
                return '';
            };

            const subLocality = get('sublocality_level_1') || get('sublocality');
            const locality    = get('locality') || get('administrative_area_level_2') || get('administrative_area_level_1');

            return {
                lat,
                lng,
                formattedAddress: best.formatted_address,
                locality,
                subLocality,
            };
        }
        console.warn('[Reverse Geocode] status:', data.status, 'error_message:', data.error_message);
        return null;
    } catch (e) {
        console.error('[Reverse Geocode]', e);
        return null;
    }
};

// ── 4. Directions API ────────────────────────────────────────────────────────

export const fetchDirections = async (
    originLatLng: { lat: number; lng: number },
    destinationLatLng: { lat: number; lng: number },
    waypointLatLngs?: { lat: number; lng: number }[],
): Promise<DirectionsResult | null> => {
    const key = getApiKey();
    if (!key) return null;
    try {
        let url = `https://maps.googleapis.com/maps/api/directions/json`
            + `?origin=${originLatLng.lat},${originLatLng.lng}`
            + `&destination=${destinationLatLng.lat},${destinationLatLng.lng}`
            + `&mode=driving`
            + `&key=${key}`;
        if (waypointLatLngs && waypointLatLngs.length > 0) {
            const wps = waypointLatLngs.map(w => `${w.lat},${w.lng}`).join('|');
            url += `&waypoints=${encodeURIComponent(wps)}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.routes.length > 0) {
            const route = data.routes[0];
            const leg = route.legs[0];
            const steps: RouteStep[] = leg.steps.map((step: any) => ({
                instruction: step.html_instructions.replace(/<[^>]+>/g, ''),
                distance: step.distance.text,
                duration: step.duration.text,
                startLat: step.start_location.lat,
                startLng: step.start_location.lng,
                endLat: step.end_location.lat,
                endLng: step.end_location.lng,
            }));
            return {
                polylineEncoded: route.overview_polyline.points,
                distanceText: leg.distance.text,
                distanceValue: leg.distance.value,
                durationText: leg.duration.text,
                durationValue: leg.duration.value,
                steps,
                startAddress: leg.start_address,
                endAddress: leg.end_address,
                bounds: route.bounds,
            };
        }
        return null;
    } catch (e) {
        console.error('[Directions]', e);
        return null;
    }
};

// ── 5. Distance Matrix API ───────────────────────────────────────────────────

export const fetchDistanceMatrix = async (
    origin: string,
    destination: string,
): Promise<DistanceMatrixResult | null> => {
    const key = getApiKey();
    if (!key) return null;
    try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json`
            + `?origins=${encodeURIComponent(origin)}`
            + `&destinations=${encodeURIComponent(destination)}`
            + `&mode=driving`
            + `&key=${key}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
            const el = data.rows[0].elements[0];
            return {
                distanceText: el.distance.text,
                distanceValue: el.distance.value,
                durationText: el.duration.text,
                durationValue: el.duration.value,
            };
        }
        return null;
    } catch (e) {
        console.error('[Distance Matrix]', e);
        return null;
    }
};

// ── 6. Decode Google Polyline ─────────────────────────────────────────────────

export const decodePolyline = (encoded: string): { latitude: number; longitude: number }[] => {
    const points: { latitude: number; longitude: number }[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    while (index < encoded.length) {
        let shift = 0, result = 0, b: number;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += result & 1 ? ~(result >> 1) : result >> 1;
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += result & 1 ? ~(result >> 1) : result >> 1;
        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
};

// ── 7. Fare Calculator ────────────────────────────────────────────────────────

export const calculateDynamicFare = (
    baseFare: number,
    costPerKm: number,
    distanceMeters: number,
): string => {
    const km = distanceMeters / 1000;
    return `₹${Math.round(baseFare + costPerKm * km)}`;
};
