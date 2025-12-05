/**
 * API Client Module
 * Handles all communication with the backend API
 */

const APIClient = {
    /**
     * Make an API request
     */
    async request(endpoint, options = {}) {
        const url = `${CONFIG.apiBaseUrl}${endpoint}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    },

    /**
     * Get all available systems
     */
    async getSystems() {
        return this.request('/systems');
    },

    /**
     * Get system statistics
     */
    async getSystemStats(systemId = CONFIG.defaultSystem) {
        return this.request(`/systems/${systemId}/stats`);
    },

    /**
     * Get all stations for a system
     */
    async getStations(systemId = CONFIG.defaultSystem, options = {}) {
        const params = new URLSearchParams();
        if (systemId) params.append('system', systemId);
        if (options.limit) params.append('limit', options.limit);
        if (options.offset) params.append('offset', options.offset);

        const query = params.toString() ? `?${params}` : '';
        return this.request(`/stations${query}`);
    },

    /**
     * Get a single station with current status
     */
    async getStation(stationId) {
        return this.request(`/stations/${stationId}`);
    },

    /**
     * Get current status of a station
     */
    async getStationCurrentStatus(stationId) {
        return this.request(`/stations/${stationId}/status/current`);
    },

    /**
     * Get historical status of a station
     */
    async getStationHistory(stationId, options = {}) {
        const params = new URLSearchParams();
        if (options.from) params.append('from', options.from);
        if (options.to) params.append('to', options.to);
        if (options.limit) params.append('limit', options.limit);

        const query = params.toString() ? `?${params}` : '';
        return this.request(`/stations/${stationId}/status${query}`);
    },

    /**
     * Legacy: Fetch stations from n8n webhook (for backwards compatibility)
     */
    async getLegacyStations() {
        try {
            const response = await fetch(CONFIG.legacyApiUrl);
            if (!response.ok) throw new Error('Legacy API error');
            return await response.json();
        } catch (error) {
            console.error('Legacy API Error:', error);
            throw error;
        }
    },

    /**
     * Legacy: Fetch parkings from n8n webhook
     */
    async getLegacyParkings() {
        try {
            const response = await fetch(CONFIG.legacyParkingsUrl);
            if (!response.ok) throw new Error('Legacy parkings API error');
            return await response.json();
        } catch (error) {
            console.error('Legacy Parkings API Error:', error);
            throw error;
        }
    },

    /**
     * Unified method to get stations (tries backend first, falls back to legacy)
     */
    async fetchStations() {
        if (CONFIG.useBackendAPI) {
            try {
                const data = await this.getStations();
                // Transform backend format to legacy format for compatibility
                return data.stations.map(s => ({
                    station_id: s.external_id,
                    name: s.name,
                    address: s.address,
                    lat: s.lat,
                    lon: s.lon,
                    capacity: s.capacity,
                    num_bikes_available: s.current_status?.bikes_available || 0,
                    num_docks_available: s.current_status?.docks_available || 0,
                    num_ebikes_available: s.current_status?.ebikes_available || 0,
                    is_renting: s.current_status?.is_renting ?? true,
                    is_returning: s.current_status?.is_returning ?? true,
                    is_installed: s.current_status?.is_installed ?? true,
                    occupancy_rate: s.current_status?.occupancy_rate || 0,
                    availability_status: s.current_status?.availability_status || 'unknown'
                }));
            } catch (error) {
                console.warn('Backend API failed, trying legacy...', error);
            }
        }

        // Fallback to legacy
        const data = await this.getLegacyStations();
        return data.stations || data;
    },

    /**
     * Unified method to get statistics
     */
    async fetchStats() {
        if (CONFIG.useBackendAPI) {
            try {
                return await this.getSystemStats();
            } catch (error) {
                console.warn('Stats API failed', error);
            }
        }
        return null;
    }
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIClient;
}
