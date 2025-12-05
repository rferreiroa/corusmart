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
            if (typeof MapManager !== 'undefined') {
                MapManager.centerDefault();
            }
            this.showNotification('Mapa centrado en A Coruña', 'info');
        });

        document.getElementById('fullScreen')?.addEventListener('click', () => {
            if (typeof MapManager !== 'undefined') {
                MapManager.toggleFullscreen();
            }
        });

        // Mobile menu toggle
        document.getElementById('menuToggle')?.addEventListener('click', () => {
            this.toggleMobileMenu();
        });

        // Close sidebar button (mobile)
        document.getElementById('closeSidebar')?.addEventListener('click', () => {
            this.closeMobileMenu();
        });

        // Close sidebar when clicking overlay (on mobile, clicking outside sidebar)
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const menuToggle = document.getElementById('menuToggle');

            if (document.body.classList.contains('menu-open') &&
                sidebar && !sidebar.contains(e.target) &&
                menuToggle && !menuToggle.contains(e.target)) {
                this.closeMobileMenu();
            }
        });

        // Handle escape key to close modals and sidebar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close any open modals
                document.querySelectorAll('.modal.active').forEach(modal => {
                    modal.classList.remove('active');
                });
                // Close mobile menu
                this.closeMobileMenu();
            }
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
     * Update statistics display (both sidebar and mobile stats bar)
     */
    updateStats(stats) {
        // Sidebar stats
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

        // Mobile stats bar (compact version)
        const mobileElements = {
            'statBikes': stats.total_bikes || '-',
            'statEbikes': stats.total_ebikes || '-',
            'statDocks': stats.total_docks || '-',
            'statEmpty': stats.empty_stations || '-'
        };

        Object.entries(mobileElements).forEach(([id, value]) => {
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
     * Toggle mobile menu (sidebar)
     */
    toggleMobileMenu() {
        const isOpen = document.body.classList.toggle('menu-open');
        // Prevent body scroll when menu is open
        document.body.style.overflow = isOpen ? 'hidden' : '';
    },

    /**
     * Close mobile menu
     */
    closeMobileMenu() {
        document.body.classList.remove('menu-open');
        document.body.style.overflow = '';
    },

    /**
     * Show station detail modal
     */
    showStationDetail(station) {
        // Create modal if doesn't exist
        let modal = document.getElementById('stationDetailModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'stationDetailModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content station-detail-modal">
                    <button class="close" aria-label="Cerrar">&times;</button>
                    <div id="stationDetailContent"></div>
                </div>
            `;
            document.body.appendChild(modal);

            // Close button
            modal.querySelector('.close').addEventListener('click', () => {
                this.hideModal('stationDetailModal');
            });
        }

        const ebikes = station.num_ebikes_available || 0;
        const normalBikes = station.num_bikes_available - ebikes;
        const occupancy = station.capacity > 0
            ? Math.round((station.num_bikes_available / station.capacity) * 100)
            : 0;

        // Populate content
        const content = document.getElementById('stationDetailContent');
        content.innerHTML = `
            <h2>${station.name}</h2>
            ${station.address ? `<p class="station-address">${station.address}</p>` : ''}

            <div class="station-detail-stats">
                <div class="detail-stat-card">
                    <div class="detail-stat-icon green">🚲</div>
                    <div class="detail-stat-value">${normalBikes}</div>
                    <div class="detail-stat-label">Bicis Normales</div>
                </div>
                <div class="detail-stat-card">
                    <div class="detail-stat-icon yellow">⚡</div>
                    <div class="detail-stat-value">${ebikes}</div>
                    <div class="detail-stat-label">Eléctricas</div>
                </div>
                <div class="detail-stat-card">
                    <div class="detail-stat-icon blue">🅿️</div>
                    <div class="detail-stat-value">${station.num_docks_available}</div>
                    <div class="detail-stat-label">Huecos Libres</div>
                </div>
                <div class="detail-stat-card">
                    <div class="detail-stat-icon ${occupancy >= 50 ? 'green' : occupancy >= 25 ? 'yellow' : 'red'}">📊</div>
                    <div class="detail-stat-value">${occupancy}%</div>
                    <div class="detail-stat-label">Ocupación</div>
                </div>
            </div>

            <div class="station-detail-info">
                <div class="info-row">
                    <span class="info-label">Capacidad total:</span>
                    <span class="info-value">${station.capacity} anclajes</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Estado:</span>
                    <span class="info-value ${station.is_renting ? 'status-ok' : 'status-warning'}">
                        ${station.is_renting ? '✅ Operativa' : '⚠️ No disponible'}
                    </span>
                </div>
            </div>

            <div class="station-detail-history">
                <h3>📈 Histórico de disponibilidad</h3>
                <p class="text-muted">Próximamente: gráficas de disponibilidad por hora/día</p>
                <div class="history-placeholder">
                    <div class="history-bar" style="height: 60%"></div>
                    <div class="history-bar" style="height: 45%"></div>
                    <div class="history-bar" style="height: 70%"></div>
                    <div class="history-bar" style="height: 55%"></div>
                    <div class="history-bar" style="height: 80%"></div>
                    <div class="history-bar" style="height: 40%"></div>
                    <div class="history-bar" style="height: 65%"></div>
                </div>
            </div>

            <div class="station-detail-actions">
                <button class="btn-primary" onclick="MapManager.centerOn(${station.lat}, ${station.lon}, 17); UIManager.hideModal('stationDetailModal');">
                    <i class="fas fa-map-marker-alt"></i> Ver en mapa
                </button>
            </div>
        `;

        this.showModal('stationDetailModal');
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
