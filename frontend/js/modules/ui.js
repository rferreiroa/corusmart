/**
 * UI Module
 * Handles user interface elements and interactions
 */

const UIManager = {
    darkMode: false,

    /**
     * Initialize UI
     */
    init() {
        this.darkMode = localStorage.getItem('darkMode') === 'true';

        if (this.darkMode) {
            document.body.classList.add('dark-mode');
            this.updateThemeButton();
        }

        this.initEventListeners();
        console.log('🎨 UI initialized');
    },

    /**
     * Initialize event listeners
     */
    initEventListeners() {
        // Theme toggle
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => this.toggleDarkMode());
        }

        // About modal
        const aboutBtn = document.getElementById('aboutBtn');
        const aboutModal = document.getElementById('aboutModal');
        const closeBtn = aboutModal?.querySelector('.close');

        if (aboutBtn) {
            aboutBtn.addEventListener('click', () => this.showModal('aboutModal'));
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideModal('aboutModal'));
        }

        // Close modals on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('active');
            }
        });

        // Map controls
        document.getElementById('centerMap')?.addEventListener('click', () => {
            MapManager.centerDefault();
        });

        document.getElementById('fullScreen')?.addEventListener('click', () => {
            MapManager.toggleFullscreen();
        });

        // Mobile menu toggle
        document.getElementById('menuToggle')?.addEventListener('click', () => {
            this.toggleMobileMenu();
        });
    },

    /**
     * Toggle dark mode
     */
    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', this.darkMode);

        // Update map tiles
        if (typeof MapManager !== 'undefined') {
            MapManager.setDarkMode(this.darkMode);
        }

        this.updateThemeButton();
        this.showNotification(
            this.darkMode ? 'Modo oscuro activado 🌙' : 'Modo claro activado ☀️',
            'info'
        );
    },

    /**
     * Update theme button text
     */
    updateThemeButton() {
        const btn = document.getElementById('themeToggle');
        if (btn) {
            if (this.darkMode) {
                btn.innerHTML = '<i class="fas fa-sun"></i><span>Modo Claro</span>';
            } else {
                btn.innerHTML = '<i class="fas fa-moon"></i><span>Modo Oscuro</span>';
            }
        }
    },

    /**
     * Show notification
     */
    showNotification(message, type = 'info', duration = 3000) {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;

        document.body.appendChild(notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        });

        // Auto-dismiss
        if (duration > 0) {
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }
    },

    /**
     * Show loading overlay
     */
    showLoading(message = 'Cargando...') {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.querySelector('p').textContent = message;
            loading.classList.add('active');
        }
    },

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.remove('active');
        }
    },

    /**
     * Show modal
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    },

    /**
     * Hide modal
     */
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    },

    /**
     * Update statistics display
     */
    updateStats(stats) {
        const elements = {
            'normalBikes': stats.total_normal_bikes || '-',
            'electricBikes': stats.total_ebikes || '-',
            'totalFreeDocks': stats.total_docks || '-',
            'emptyStationsCount': stats.empty_stations || '-',
            'activeStations': stats.total_stations || '-',
            'availableBikes': stats.total_bikes || '-',
            'availableDocks': stats.total_docks || '-',
            'avgOccupancy': stats.avg_occupancy ? `${stats.avg_occupancy}%` : '-'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    },

    /**
     * Update last update timestamp
     */
    updateTimestamp() {
        const el = document.getElementById('lastUpdate');
        if (el) {
            const now = new Date();
            const time = now.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            el.textContent = `Última actualización: ${time}`;
        }
    },

    /**
     * Update top stations list
     */
    updateTopStations(stations) {
        const container = document.getElementById('topStationsList');
        if (!container) return;

        // Sort by bikes available and take top 5
        const top5 = [...stations]
            .filter(s => s.is_installed && s.is_renting)
            .sort((a, b) => b.num_bikes_available - a.num_bikes_available)
            .slice(0, 5);

        container.innerHTML = top5.map((station, index) => `
            <div class="station-card" onclick="MapManager.centerOn(${station.lat}, ${station.lon}, 16)">
                <div class="station-rank">${index + 1}</div>
                <div class="station-info">
                    <div class="station-name">${station.name}</div>
                    <div class="station-stats">
                        <span class="bikes">🚲 ${station.num_bikes_available}</span>
                        <span class="docks">🅿️ ${station.num_docks_available}</span>
                    </div>
                </div>
            </div>
        `).join('');
    },

    /**
     * Toggle mobile menu
     */
    toggleMobileMenu() {
        document.body.classList.toggle('menu-open');
    },

    /**
     * Update nearby stations (for geolocation feature)
     */
    updateNearbyStations(stations, userLat, userLon) {
        const container = document.getElementById('nearbyResults');
        if (!container || !stations.length) return;

        // Calculate distances and sort
        const withDistance = stations.map(station => ({
            ...station,
            distance: this.calculateDistance(userLat, userLon, station.lat, station.lon)
        })).sort((a, b) => a.distance - b.distance).slice(0, 5);

        container.innerHTML = withDistance.map(station => `
            <div class="nearby-station" onclick="MapManager.centerOn(${station.lat}, ${station.lon}, 16)">
                <div class="nearby-info">
                    <div class="nearby-name">${station.name}</div>
                    <div class="nearby-distance">${station.distance < 1
                        ? `${Math.round(station.distance * 1000)}m`
                        : `${station.distance.toFixed(1)}km`}</div>
                </div>
                <div class="nearby-stats">
                    <span>🚲 ${station.num_bikes_available}</span>
                </div>
            </div>
        `).join('');
    },

    /**
     * Calculate distance between two points (Haversine)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
}
