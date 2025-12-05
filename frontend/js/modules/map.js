/**
 * Map Module
 * Handles all Leaflet map functionality
 */

const MapManager = {
    map: null,
    markersLayer: null,
    stationMarkers: {},
    parkingMarkers: {},
    lightTiles: null,
    darkTiles: null,
    userMarker: null,
    routeLayer: null,

    /**
     * Initialize the map
     */
    init(containerId = 'map') {
        this.map = L.map(containerId, {
            zoomControl: true,
            attributionControl: true
        }).setView(CONFIG.map.center, CONFIG.map.zoom);

        // Create tile layers
        this.lightTiles = L.tileLayer(CONFIG.tiles.light.url, {
            attribution: CONFIG.tiles.light.attribution,
            maxZoom: CONFIG.map.maxZoom
        });

        this.darkTiles = L.tileLayer(CONFIG.tiles.dark.url, {
            attribution: CONFIG.tiles.dark.attribution,
            maxZoom: CONFIG.map.maxZoom
        });

        // Add default tiles
        const isDarkMode = document.body.classList.contains('dark-mode');
        if (isDarkMode) {
            this.darkTiles.addTo(this.map);
        } else {
            this.lightTiles.addTo(this.map);
        }

        // Create markers layer
        this.markersLayer = L.layerGroup().addTo(this.map);

        // Create route layer
        this.routeLayer = L.layerGroup().addTo(this.map);

        console.log('🗺️ Map initialized');
        return this;
    },

    /**
     * Switch between light and dark tiles
     */
    setDarkMode(enabled) {
        if (enabled) {
            this.map.removeLayer(this.lightTiles);
            this.darkTiles.addTo(this.map);
        } else {
            this.map.removeLayer(this.darkTiles);
            this.lightTiles.addTo(this.map);
        }
    },

    /**
     * Create a station marker
     */
    createStationMarker(station) {
        const availability = this.getAvailabilityLevel(station);
        const color = CONFIG.colors[availability];

        const icon = L.divIcon({
            className: 'station-marker',
            html: `
                <div class="marker-container ${availability}">
                    <div class="marker-icon" style="background-color: ${color}">
                        <span class="bike-count">${station.num_bikes_available}</span>
                    </div>
                    <div class="marker-label">${station.name.substring(0, 15)}...</div>
                </div>
            `,
            iconSize: [40, 50],
            iconAnchor: [20, 50],
            popupAnchor: [0, -45]
        });

        const marker = L.marker([station.lat, station.lon], { icon });
        marker.bindPopup(() => this.createStationPopup(station));

        return marker;
    },

    /**
     * Get availability level based on thresholds
     */
    getAvailabilityLevel(station) {
        if (!station.is_installed || (!station.is_renting && !station.is_returning)) {
            return 'inactive';
        }

        const total = station.num_bikes_available + station.num_docks_available;
        if (total === 0) return 'inactive';

        const percentage = (station.num_bikes_available / total) * 100;

        if (percentage >= CONFIG.thresholds.high) return 'high';
        if (percentage >= CONFIG.thresholds.medium) return 'medium';
        return 'low';
    },

    /**
     * Create popup content for a station
     */
    createStationPopup(station) {
        const ebikes = station.num_ebikes_available || 0;
        const normalBikes = station.num_bikes_available - ebikes;
        const availability = this.getAvailabilityLevel(station);

        return `
            <div class="station-popup ${availability}">
                <h4>${station.name}</h4>
                ${station.address ? `<p class="address">${station.address}</p>` : ''}
                <div class="popup-stats">
                    <div class="popup-stat">
                        <span class="icon">🚲</span>
                        <span class="value">${normalBikes}</span>
                        <span class="label">Normales</span>
                    </div>
                    <div class="popup-stat">
                        <span class="icon">⚡</span>
                        <span class="value">${ebikes}</span>
                        <span class="label">Eléctricas</span>
                    </div>
                    <div class="popup-stat">
                        <span class="icon">🅿️</span>
                        <span class="value">${station.num_docks_available}</span>
                        <span class="label">Huecos</span>
                    </div>
                </div>
                <div class="popup-actions">
                    <button onclick="StationsManager.showDetails(${station.station_id})">
                        Ver detalles
                    </button>
                    <button onclick="RoutingManager.routeToStation(${station.lat}, ${station.lon})">
                        Cómo llegar
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Update all station markers
     */
    updateStations(stations, filters = {}) {
        // Clear existing markers
        this.markersLayer.clearLayers();
        this.stationMarkers = {};

        stations.forEach(station => {
            const availability = this.getAvailabilityLevel(station);

            // Apply filters
            if (filters.showHigh === false && availability === 'high') return;
            if (filters.showMedium === false && availability === 'medium') return;
            if (filters.showLow === false && availability === 'low') return;
            if (filters.showInactive === false && availability === 'inactive') return;

            const marker = this.createStationMarker(station);
            marker.addTo(this.markersLayer);
            this.stationMarkers[station.station_id] = marker;
        });
    },

    /**
     * Center map on coordinates
     */
    centerOn(lat, lon, zoom = 15) {
        this.map.setView([lat, lon], zoom);
    },

    /**
     * Center map on default location
     */
    centerDefault() {
        this.map.setView(CONFIG.map.center, CONFIG.map.zoom);
    },

    /**
     * Set user location marker
     */
    setUserLocation(lat, lon) {
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
        }

        const icon = L.divIcon({
            className: 'user-marker',
            html: '<div class="user-location-dot"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        this.userMarker = L.marker([lat, lon], { icon }).addTo(this.map);
        this.centerOn(lat, lon);
    },

    /**
     * Draw a route on the map
     */
    drawRoute(coordinates, color = '#3b82f6', weight = 4) {
        this.routeLayer.clearLayers();

        const polyline = L.polyline(coordinates, {
            color: color,
            weight: weight,
            opacity: 0.8,
            smoothFactor: 1
        });

        polyline.addTo(this.routeLayer);
        this.map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    },

    /**
     * Clear all routes
     */
    clearRoutes() {
        this.routeLayer.clearLayers();
    },

    /**
     * Toggle fullscreen
     */
    toggleFullscreen() {
        const container = this.map.getContainer().parentElement;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container.requestFullscreen();
        }
    }
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapManager;
}
