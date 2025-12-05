/**
 * BiciCoruña - Main Application
 * Entry point that initializes all modules
 */

const App = {
    updateTimer: null,
    initialized: false,

    /**
     * Initialize the application
     */
    async init() {
        if (this.initialized) return;

        console.log('🚲 BiciCoruña v2.0 - Initializing...');

        try {
            // Initialize UI first (handles theme)
            UIManager.init();

            // Initialize Map
            MapManager.init('map');

            // Initialize Stations Manager
            StationsManager.init();

            // Load initial data
            await StationsManager.fetchStations();

            // Start auto-update
            this.startAutoUpdate();

            // Initialize refresh button
            this.initRefreshButton();

            this.initialized = true;
            console.log('✅ BiciCoruña initialized successfully!');

        } catch (error) {
            console.error('❌ Initialization error:', error);
            UIManager.showNotification('Error al inicializar la aplicación', 'error');
        }
    },

    /**
     * Start automatic data updates
     */
    startAutoUpdate() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }

        this.updateTimer = setInterval(async () => {
            console.log('🔄 Auto-updating stations...');
            await StationsManager.fetchStations();
        }, CONFIG.updateInterval);

        console.log(`⏱️ Auto-update scheduled every ${CONFIG.updateInterval / 1000}s`);
    },

    /**
     * Stop automatic updates
     */
    stopAutoUpdate() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    },

    /**
     * Manual refresh
     */
    async refresh() {
        UIManager.showNotification('Actualizando...', 'info', 1500);
        await StationsManager.fetchStations();
        UIManager.showNotification('Datos actualizados', 'success');
    },

    /**
     * Initialize refresh button
     */
    initRefreshButton() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refresh());
        }
    },

    /**
     * Change active system
     */
    async changeSystem(systemId) {
        if (!CONFIG.systems[systemId]) {
            UIManager.showNotification('Sistema no disponible', 'error');
            return;
        }

        if (!CONFIG.systems[systemId].active) {
            UIManager.showNotification('Sistema próximamente', 'info');
            return;
        }

        // Update config
        CONFIG.defaultSystem = systemId;

        // Reload data
        await StationsManager.fetchStations();

        UIManager.showNotification(
            `Cambiado a ${CONFIG.systems[systemId].name}`,
            'success'
        );
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Handle visibility changes (pause updates when tab is hidden)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        App.stopAutoUpdate();
    } else {
        App.startAutoUpdate();
        StationsManager.fetchStations(); // Refresh on return
    }
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}
