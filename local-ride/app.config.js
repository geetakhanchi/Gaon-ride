/**
 * app.config.js — Dynamic Expo config
 * Extends app.json and injects environment variables that cannot
 * be resolved from a static JSON file (e.g. native SDK API keys).
 *
 * Expo CLI automatically loads .env files, so
 * process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is available here.
 */
const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

module.exports = ({ config }) => ({
    ...config,

    // ── iOS: Google Maps SDK native init key ─────────────────────────────────
    ios: {
        ...config.ios,
        config: {
            ...(config.ios?.config ?? {}),
            googleMapsApiKey: mapsKey,
        },
    },

    // ── Android: Google Maps SDK native init key ─────────────────────────────
    android: {
        ...config.android,
        config: {
            ...(config.android?.config ?? {}),
            googleMaps: {
                apiKey: mapsKey,
            },
        },
    },
});
