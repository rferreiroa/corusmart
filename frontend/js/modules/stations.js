/**
 * Stations Module
 * Manages station data and interactions
 */

const StationsManager = {
    stations: [],
    filters: {
        showHigh: true,
        showMedium: true,
        showLow: true,
        showInactive: true,
        bikeType: 'any'
    },
    userLocation: null,

    /**
     * Initialize stations manager
     */
    init() {
        this.initFilterListeners();
        this.initLocationListener();
        console.log('📍 Stations manager initialized');
    },

    /**
     * Initialize filter listeners
     */
    initFilterListeners() {
        ['showHigh', 'showMedium', 'showLow', 'showInactive'].forEach(filterId => {
            const checkbox = document.getElementById(filterId);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.filters[filterId] = e.target.checked;
                    this.applyFilters();
                });
            }
        });

        const bikeTypeFilter = document.getElementById('bikeTypeFilter');
        if (bikeTypeFilter) {
            bikeTypeFilter.addEventListener('change', (e) => {
                this.filters.bikeType = e.target.value;
                this.applyFilters();
            });
        }
    },

    /**
     * Initialize location listener
     */
    initLocationListener() {
        const locationBtn = document.getElementById('useMyLocation');
        if (locationBtn) {
            locationBtn.addEventListener('click', () => this.getUserLocation());
        }
    },

    /**
     * Fetch and update stations
     */
    async fetchStations() {
        try {
            UIManager.showLoading('Cargando estaciones...');

            this.stations = await APIClient.fetchStations();

            // Update map markers
            MapManager.updateStations(this.stations, this.filters);

            // Update statistics
            this.updateStats();

            // Update UI
            UIManager.updateTopStations(this.stations);
            UIManager.updateTimestamp();

            // Update nearby if user location exists
            if (this.userLocation) {
                UIManager.updateNearbyStations(
                    this.stations,
                    this.userLocation.lat,
                    this.userLocation.lon
                );
            }

            UIManager.hideLoading();
            console.log(`✅ Loaded ${this.stations.length} stations`);

        } catch (error) {
            UIManager.hideLoading();
            UIManager.showNotification('Error al cargar estaciones', 'error');
            console.error('Error fetching stations:', error);
        }
    },

    /**
     * Calculate and update statistics
     */
    updateStats() {
        const stats = {
            total_stations: this.stations.length,
            total_bikes: 0,
            total_docks: 0,
            total_ebikes: 0,
            total_normal_bikes: 0,
            empty_stations: 0,
            full_stations: 0,
            avg_occupancy: 0
        };

        let occupancySum = 0;
        let activeCount = 0;

        this.stations.forEach(station => {
            stats.total_bikes += station.num_bikes_available || 0;
            stats.total_docks += station.num_docks_available || 0;
            stats.total_ebikes += station.num_ebikes_available || 0;

            if (station.num_bikes_available === 0) stats.empty_stations++;
            if (station.num_docks_available === 0) stats.full_stations++;

            const capacity = station.num_bikes_available + station.num_docks_available;
            if (capacity > 0) {
                occupancySum += (station.num_bikes_available / capacity) * 100;
                activeCount++;
            }
        });

        stats.total_normal_bikes = stats.total_bikes - stats.total_ebikes;
        stats.avg_occupancy = activeCount > 0
            ? Math.round(occupancySum / activeCount)
            : 0;

        UIManager.updateStats(stats);
    },

    /**
     * Apply filters and update map
     */
    applyFilters() {
        let filtered = [...this.stations];

        // Apply bike type filter
        if (this.filters.bikeType === 'electric') {
            filtered = filtered.filter(s => s.num_ebikes_available > 0);
        } else if (this.filters.bikeType === 'normal') {
            filtered = filtered.filter(s =>
                (s.num_bikes_available - (s.num_ebikes_available || 0)) > 0
            );
        }

        MapManager.updateStations(filtered, this.filters);
    },

    /**
     * Get user's current location
     */
    getUserLocation() {
        if (!navigator.geolocation) {
            UIManager.showNotification('Geolocalización no disponible', 'error');
            return;
        }

        UIManager.showNotification('Obteniendo ubicación...', 'info', 5000);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.userLocation = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };

                MapManager.setUserLocation(this.userLocation.lat, this.userLocation.lon);
                UIManager.updateNearbyStations(
                    this.stations,
                    this.userLocation.lat,
                    this.userLocation.lon
                );

                UIManager.showNotification('Ubicación actualizada', 'success');
            },
            (error) => {
                console.error('Geolocation error:', error);
                UIManager.showNotification('No se pudo obtener la ubicación', 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            }
        );
    },

    /**
     * Show station details modal
     */
    showDetails(stationId) {
        const station = this.stations.find(s =>
            s.station_id === stationId || s.id === stationId
        );

        if (!station) {
            UIManager.showNotification('Estación no encontrada', 'error');
            return;
        }

        // For now, just center on the station
        // In the future, this could show a detail modal with history
        MapManager.centerOn(station.lat, station.lon, 17);
        UIManager.showNotification(`Mostrando: ${station.name}`, 'info');
    },

    /**
     * Find stations near a point
     */
    findNearby(lat, lon, maxDistance = 1) {
        return this.stations
            .map(station => ({
                ...station,
                distance: UIManager.calculateDistance(lat, lon, station.lat, station.lon)
            }))
            .filter(s => s.distance <= maxDistance)
            .sort((a, b) => a.distance - b.distance);
    },

    /**
     * Get station by ID
     */
    getStation(stationId) {
        return this.stations.find(s =>
            s.station_id === stationId || s.id === stationId
        );
    }
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StationsManager;
}
