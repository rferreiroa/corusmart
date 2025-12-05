/**
 * Configuration for BiciCoruña Frontend
 *
 * This file contains all environment-dependent configuration.
 * In production, these values should be replaced during build/deploy.
 */

const CONFIG = {
    // API Configuration
    // Change this to your backend URL in production
    apiBaseUrl: window.location.hostname === 'localhost'
        ? 'http://localhost:8000/api/v1'
        : '/api/v1',

    // Legacy n8n endpoints (for backwards compatibility)
    n8nUrl: 'http://localhost:5678',
    legacyApiUrl: 'http://localhost:5678/webhook/bicicoruna',
    legacyParkingsUrl: 'http://localhost:5678/webhook/parkings',

    // Feature flags
    useBackendAPI: true,  // Set to false to use legacy n8n endpoints

    // Default system
    defaultSystem: 'bicicoruna',

    // Map configuration
    map: {
        center: [43.3623, -8.4115],  // A Coruña center
        zoom: 13,
        minZoom: 11,
        maxZoom: 19,
        bounds: {
            south: 43.30,
            west: -8.50,
            north: 43.42,
            east: -8.30
        }
    },

    // Update interval in milliseconds
    updateInterval: 120000,  // 2 minutes

    // Default destination for routing
    defaultDestination: {
        name: 'Obelisco (Centro)',
        lat: 43.3715,
        lon: -8.3962
    },

    // OpenRouteService (if using direct API calls)
    // NOTE: In production, this should go through your backend
    routing: {
        enabled: true,
        apiUrl: 'https://api.openrouteservice.org/v2/directions'
        // API key is now handled by backend proxy
    },

    // Tile providers
    tiles: {
        light: {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '© OpenStreetMap | BiciCoruña'
        },
        dark: {
            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            attribution: '© OpenStreetMap, © CartoDB | BiciCoruña'
        }
    },

    // Availability thresholds (percentages)
    thresholds: {
        high: 75,    // >= 75% = green
        medium: 25,  // >= 25% = yellow/orange
        low: 0       // < 25% = red
    },

    // Colors for markers
    colors: {
        high: '#22c55e',      // Green
        medium: '#f59e0b',    // Orange
        low: '#ef4444',       // Red
        inactive: '#6b7280',  // Gray
        parking: '#3b82f6'    // Blue
    },

    // Systems configuration (for multi-system support)
    systems: {
        bicicoruna: {
            id: 'bicicoruna',
            name: 'Bicicoruña',
            city: 'A Coruña',
            icon: '🚲',
            active: true
        },
        bicimad: {
            id: 'bicimad',
            name: 'BiciMAD',
            city: 'Madrid',
            icon: '🚴',
            active: false  // Coming soon
        },
        renfe: {
            id: 'renfe',
            name: 'Renfe Cercanías',
            city: 'España',
            icon: '🚆',
            active: false  // Coming soon
        }
    },

    // POIs (Points of Interest) for quick destination selection
    pois: [
        { name: 'Plaza María Pita', lat: 43.3715, lon: -8.3962, icon: '🏛️', type: 'government' },
        { name: 'Playa de Riazor', lat: 43.3678, lon: -8.4130, icon: '🏖️', type: 'beach' },
        { name: 'Calle Real', lat: 43.3710, lon: -8.3975, icon: '🛍️', type: 'shopping' },
        { name: 'Torre de Hércules', lat: 43.3857, lon: -8.4066, icon: '🗼', type: 'monument' },
        { name: 'Aquarium Finisterrae', lat: 43.3869, lon: -8.4019, icon: '🐠', type: 'museum' },
        { name: 'Palacio de la Ópera', lat: 43.3561, lon: -8.4078, icon: '🎭', type: 'culture' },
        { name: 'Obelisco', lat: 43.3703, lon: -8.3960, icon: '📍', type: 'landmark' },
        { name: 'Estación de Tren', lat: 43.3511, lon: -8.4003, icon: '🚉', type: 'transport' }
    ]
};

// Freeze config to prevent accidental modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.map);
Object.freeze(CONFIG.tiles);
Object.freeze(CONFIG.thresholds);
Object.freeze(CONFIG.colors);
Object.freeze(CONFIG.systems);

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
