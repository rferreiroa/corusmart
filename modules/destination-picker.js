/* =====================================================
   DESTINATION PICKER MODULE
   BiciCoruña Premium v2.3
   
   Selector de destino flexible:
   - Click en mapa
   - Búsqueda por texto (Nominatim)
   - Lista de POIs predefinidos
   - Historial de destinos recientes
===================================================== */

const DestinationPicker = {
    // ===== CONFIGURACIÓN =====
    config: {
        geocodingUrl: 'https://nominatim.openstreetmap.org/search',
        maxHistoryItems: 5,
        searchBounds: {
            // Limitar búsquedas a área A Coruña
            minLat: 43.32,
            maxLat: 43.40,
            minLon: -8.45,
            maxLon: -8.35
        }
    },

    // ===== DESTINOS PREDEFINIDOS (POIs A Coruña) =====
    predefinedDestinations: [
        {
            id: 'maria_pita',
            name: 'Plaza María Pita',
            icon: '🏛️',
            category: 'Centro',
            lat: 43.3715,
            lon: -8.3975,
            description: 'Plaza principal y Ayuntamiento',
            parkingDifficulty: 'high', // high, medium, low
            estimatedSearchTime: 10 // minutos buscar parking
        },
        {
            id: 'riazor',
            name: 'Playa de Riazor',
            icon: '🏖️',
            category: 'Playas',
            lat: 43.3712,
            lon: -8.4165,
            description: 'Playa urbana principal',
            parkingDifficulty: 'medium',
            estimatedSearchTime: 5
        },
        {
            id: 'calle_real',
            name: 'Calle Real',
            icon: '🛍️',
            category: 'Comercial',
            lat: 43.3698,
            lon: -8.3961,
            description: 'Zona comercial peatonal',
            parkingDifficulty: 'high',
            estimatedSearchTime: 12
        },
        {
            id: 'torre_hercules',
            name: 'Torre de Hércules',
            icon: '🗼',
            category: 'Turismo',
            lat: 43.3850,
            lon: -8.4062,
            description: 'Faro romano Patrimonio UNESCO',
            parkingDifficulty: 'low',
            estimatedSearchTime: 2
        },
        {
            id: 'aquarium',
            name: 'Aquarium Finisterrae',
            icon: '🐟',
            category: 'Turismo',
            lat: 43.3782,
            lon: -8.4178,
            description: 'Museo interactivo',
            parkingDifficulty: 'medium',
            estimatedSearchTime: 4
        },
        {
            id: 'opera',
            name: 'Palacio de la Ópera',
            icon: '🎭',
            category: 'Cultura',
            lat: 43.3701,
            lon: -8.3989,
            description: 'Auditorio y centro cultural',
            parkingDifficulty: 'medium',
            estimatedSearchTime: 5
        },
        {
            id: 'obelisco',
            name: 'Obelisco',
            icon: '📍',
            category: 'Centro',
            lat: 43.3715,
            lon: -8.3962,
            description: 'Plaza del Obelisco',
            parkingDifficulty: 'high',
            estimatedSearchTime: 10
        },
        {
            id: 'estadio_riazor',
            name: 'Estadio Riazor',
            icon: '⚽',
            category: 'Deportes',
            lat: 43.3687,
            lon: -8.4190,
            description: 'Estadio del Deportivo',
            parkingDifficulty: 'low',
            estimatedSearchTime: 3
        }
    ],

    // ===== STATE =====
    state: {
        selectedDestination: null,
        tempMarker: null,
        searchHistory: [],
        isSelecting: false
    },

    // ===== INICIALIZACIÓN =====
    init() {
        console.log('🎯 Initializing Destination Picker...');
        this.loadHistory();
        this.setupEventListeners();
        this.createUI();
        console.log('✅ Destination Picker ready');
    },

    // ===== CARGAR HISTORIAL =====
    loadHistory() {
        try {
            const saved = localStorage.getItem('destinationHistory');
            if (saved) {
                this.state.searchHistory = JSON.parse(saved);
                console.log(`📚 Loaded ${this.state.searchHistory.length} history items`);
            }
        } catch (error) {
            console.error('Error loading history:', error);
        }
    },

    // ===== GUARDAR HISTORIAL =====
    saveHistory() {
        try {
            localStorage.setItem('destinationHistory', JSON.stringify(this.state.searchHistory));
        } catch (error) {
            console.error('Error saving history:', error);
        }
    },

    // ===== AÑADIR A HISTORIAL =====
    addToHistory(destination) {
        // Evitar duplicados
        this.state.searchHistory = this.state.searchHistory.filter(
            item => !(item.lat === destination.lat && item.lon === destination.lon)
        );
        
        // Añadir al principio
        this.state.searchHistory.unshift({
            ...destination,
            timestamp: new Date().toISOString()
        });
        
        // Limitar a N items
        if (this.state.searchHistory.length > this.config.maxHistoryItems) {
            this.state.searchHistory = this.state.searchHistory.slice(0, this.config.maxHistoryItems);
        }
        
        this.saveHistory();
    },

    // ===== CREAR UI =====
    createUI() {
        // Añadir botón "Elegir Destino" en el sidebar
        const sidebar = document.querySelector('.sidebar') || document.querySelector('.left-panel');
        if (!sidebar) {
            console.error('Sidebar not found');
            return;
        }

        const buttonHtml = `
            <button onclick="DestinationPicker.showModal()" class="btn-action btn-highlight" style="margin-top: 10px;">
                <i class="fas fa-map-marker-alt"></i> Elegir Destino
            </button>
        `;

        // Insertar después del botón "Usar Mi Ubicación"
        const locationBtn = Array.from(sidebar.querySelectorAll('button')).find(btn => 
            btn.textContent.includes('Ubicación')
        );
        
        if (locationBtn) {
            locationBtn.insertAdjacentHTML('afterend', buttonHtml);
        } else {
            sidebar.insertAdjacentHTML('beforeend', buttonHtml);
        }
    },

    // ===== SETUP EVENT LISTENERS =====
    setupEventListeners() {
        // Click en mapa para seleccionar destino
        if (typeof map !== 'undefined') {
            map.on('click', (e) => {
                if (this.state.isSelecting) {
                    this.handleMapClick(e.latlng);
                }
            });
        }
    },

    // ===== MOSTRAR MODAL DE SELECCIÓN =====
    showModal() {
        const modal = document.createElement('div');
        modal.id = 'destinationPickerModal';
        modal.className = 'destination-modal';
        
        modal.innerHTML = `
            <div class="destination-modal-content">
                <div class="destination-modal-header">
                    <h2><i class="fas fa-map-marker-alt"></i> Seleccionar Destino</h2>
                    <button onclick="DestinationPicker.closeModal()" class="btn-close-modal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="destination-modal-body">
                    <!-- TABS -->
                    <div class="destination-tabs">
                        <button class="tab-btn active" onclick="DestinationPicker.switchTab('predefined')">
                            <i class="fas fa-star"></i> Populares
                        </button>
                        <button class="tab-btn" onclick="DestinationPicker.switchTab('search')">
                            <i class="fas fa-search"></i> Buscar
                        </button>
                        <button class="tab-btn" onclick="DestinationPicker.switchTab('map')">
                            <i class="fas fa-map"></i> Click en Mapa
                        </button>
                        <button class="tab-btn" onclick="DestinationPicker.switchTab('history')">
                            <i class="fas fa-history"></i> Recientes
                        </button>
                    </div>

                    <!-- TAB CONTENT: PREDEFINED -->
                    <div id="tab-predefined" class="tab-content active">
                        <div class="predefined-grid">
                            ${this.renderPredefinedDestinations()}
                        </div>
                    </div>

                    <!-- TAB CONTENT: SEARCH -->
                    <div id="tab-search" class="tab-content" style="display:none;">
                        <div class="search-box">
                            <input type="text" id="destinationSearchInput" placeholder="Ej: Plaza María Pita, Calle Real..." />
                            <button onclick="DestinationPicker.searchByText()">
                                <i class="fas fa-search"></i> Buscar
                            </button>
                        </div>
                        <div id="searchResults" class="search-results"></div>
                    </div>

                    <!-- TAB CONTENT: MAP -->
                    <div id="tab-map" class="tab-content" style="display:none;">
                        <div class="map-instructions">
                            <i class="fas fa-hand-pointer fa-3x"></i>
                            <p><strong>Haz click en el mapa</strong> donde quieras ir</p>
                            <button onclick="DestinationPicker.activateMapSelection()" class="btn-primary">
                                <i class="fas fa-crosshairs"></i> Activar Selector
                            </button>
                        </div>
                    </div>

                    <!-- TAB CONTENT: HISTORY -->
                    <div id="tab-history" class="tab-content" style="display:none;">
                        <div class="history-list">
                            ${this.renderHistory()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Focus en input de búsqueda si es tab activa
        setTimeout(() => {
            const searchInput = document.getElementById('destinationSearchInput');
            if (searchInput) {
                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.searchByText();
                    }
                });
            }
        }, 100);
    },

    // ===== CERRAR MODAL =====
    closeModal() {
        const modal = document.getElementById('destinationPickerModal');
        if (modal) modal.remove();
        this.state.isSelecting = false;
    },

    // ===== CAMBIAR TAB =====
    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
        
        event.target.closest('.tab-btn').classList.add('active');
        document.getElementById(`tab-${tabName}`).style.display = 'block';
    },

    // ===== RENDER DESTINOS PREDEFINIDOS =====
    renderPredefinedDestinations() {
        return this.predefinedDestinations.map(dest => `
            <div class="dest-card" onclick="DestinationPicker.selectPredefined('${dest.id}')">
                <div class="dest-icon">${dest.icon}</div>
                <div class="dest-info">
                    <strong>${dest.name}</strong>
                    <span class="dest-category">${dest.category}</span>
                    <small>${dest.description}</small>
                </div>
            </div>
        `).join('');
    },

    // ===== RENDER HISTORIAL =====
    renderHistory() {
        if (this.state.searchHistory.length === 0) {
            return '<p style="text-align:center; color:#999; padding:40px;">No hay destinos recientes</p>';
        }

        return this.state.searchHistory.map((dest, index) => `
            <div class="history-item" onclick="DestinationPicker.selectFromHistory(${index})">
                <i class="fas fa-history"></i>
                <div>
                    <strong>${dest.name}</strong>
                    <small>${new Date(dest.timestamp).toLocaleDateString('es-ES')}</small>
                </div>
            </div>
        `).join('');
    },

    // ===== SELECCIONAR PREDEFINIDO =====
    selectPredefined(id) {
        const dest = this.predefinedDestinations.find(d => d.id === id);
        if (!dest) return;

        this.selectDestination(dest);
    },

    // ===== SELECCIONAR DESDE HISTORIAL =====
    selectFromHistory(index) {
        const dest = this.state.searchHistory[index];
        if (!dest) return;

        this.selectDestination(dest);
    },

    // ===== BUSCAR POR TEXTO (NOMINATIM) =====
    async searchByText() {
        const input = document.getElementById('destinationSearchInput');
        const query = input.value.trim();
        
        if (!query) {
            alert('Escribe algo para buscar');
            return;
        }

        const resultsDiv = document.getElementById('searchResults');
        resultsDiv.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Buscando...</div>';

        try {
            const url = new URL(this.config.geocodingUrl);
            url.searchParams.append('q', `${query}, A Coruña, España`);
            url.searchParams.append('format', 'json');
            url.searchParams.append('limit', '5');
            url.searchParams.append('bounded', '1');
            url.searchParams.append('viewbox', `${this.config.searchBounds.minLon},${this.config.searchBounds.maxLat},${this.config.searchBounds.maxLon},${this.config.searchBounds.minLat}`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'BiciCoruna-Premium/2.0'
                }
            });

            if (!response.ok) throw new Error('Search failed');

            const results = await response.json();

            if (results.length === 0) {
                resultsDiv.innerHTML = '<p style="text-align:center; color:#999;">No se encontraron resultados</p>';
                return;
            }

            resultsDiv.innerHTML = results.map((result, index) => `
                <div class="search-result-item" onclick="DestinationPicker.selectSearchResult(${index}, ${JSON.stringify(result).replace(/"/g, '&quot;')})">
                    <i class="fas fa-map-pin"></i>
                    <div>
                        <strong>${result.display_name.split(',')[0]}</strong>
                        <small>${result.display_name}</small>
                    </div>
                </div>
            `).join('');

            // Guardar resultados temporalmente
            window._searchResults = results;

        } catch (error) {
            console.error('Search error:', error);
            resultsDiv.innerHTML = '<p style="color:red;">Error en la búsqueda</p>';
        }
    },

    // ===== SELECCIONAR RESULTADO BÚSQUEDA =====
    selectSearchResult(index, result) {
        const dest = {
            name: result.display_name.split(',')[0],
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon),
            description: result.display_name,
            parkingDifficulty: 'medium',
            estimatedSearchTime: 5
        };

        this.selectDestination(dest);
    },

    // ===== ACTIVAR SELECCIÓN EN MAPA =====
    activateMapSelection() {
        this.state.isSelecting = true;
        this.closeModal();
        
        showNotification('Haz click en el mapa donde quieras ir', 'info');
        
        // Cambiar cursor del mapa
        if (typeof map !== 'undefined') {
            map.getContainer().style.cursor = 'crosshair';
        }
    },

    // ===== MANEJAR CLICK EN MAPA =====
    async handleMapClick(latlng) {
        this.state.isSelecting = false;
        
        if (typeof map !== 'undefined') {
            map.getContainer().style.cursor = '';
        }

        // Crear marcador temporal
        if (this.state.tempMarker) {
            map.removeLayer(this.state.tempMarker);
        }

        this.state.tempMarker = L.marker([latlng.lat, latlng.lng], {
            icon: L.divIcon({
                className: 'temp-destination-marker',
                html: '<div style="background:#dc3545; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:24px; border:3px solid white; box-shadow:0 4px 12px rgba(0,0,0,0.3);">📍</div>',
                iconSize: [40, 40]
            })
        }).addTo(map);

        // Reverse geocoding para obtener nombre
        showNotification('Obteniendo información del lugar...', 'info');

        const dest = {
            name: 'Punto seleccionado',
            lat: latlng.lat,
            lon: latlng.lng,
            description: `Lat: ${latlng.lat.toFixed(4)}, Lon: ${latlng.lng.toFixed(4)}`,
            parkingDifficulty: 'medium',
            estimatedSearchTime: 5
        };

        // Intentar obtener nombre del lugar
        try {
            const reverseUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json`;
            const response = await fetch(reverseUrl);
            const data = await response.json();
            
            if (data && data.display_name) {
                dest.name = data.display_name.split(',')[0] || 'Punto seleccionado';
                dest.description = data.display_name;
            }
        } catch (error) {
            console.log('Reverse geocoding failed, using coordinates');
        }

        this.selectDestination(dest);
    },

    // ===== SELECCIONAR DESTINO FINAL =====
    selectDestination(destination) {
        console.log('✅ Destination selected:', destination);

        this.state.selectedDestination = destination;
        this.addToHistory(destination);
        this.closeModal();

        // Mostrar en mapa
        if (this.state.tempMarker) {
            map.removeLayer(this.state.tempMarker);
        }

        this.state.tempMarker = L.marker([destination.lat, destination.lon], {
            icon: L.divIcon({
                className: 'selected-destination-marker',
                html: '<div style="background:#dc3545; width:50px; height:50px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; border:4px solid white; box-shadow:0 6px 16px rgba(0,0,0,0.4);"><span style="transform:rotate(45deg); font-size:28px;">🎯</span></div>',
                iconSize: [50, 50],
                iconAnchor: [25, 50]
            })
        }).addTo(map);

        this.state.tempMarker.bindPopup(`
            <div style="text-align:center;">
                <strong style="font-size:16px;">${destination.name}</strong><br>
                <small>${destination.description || ''}</small><br>
                <button onclick="DestinationPicker.calculateRoutes()" style="margin-top:10px; padding:8px 16px; background:linear-gradient(135deg,#667eea,#764ba2); color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">
                    ✨ Calcular Rutas
                </button>
            </div>
        `).openPopup();

        map.setView([destination.lat, destination.lon], 15);

        showNotification(`Destino seleccionado: ${destination.name}`, 'success');
    },

     // ===== CALCULAR RUTAS (VERSIÓN CORREGIDA) =====
    async calculateRoutes() {
        if (!this.state.selectedDestination) {
            alert('Primero selecciona un destino');
            return;
        }

        // Verificar ubicación del usuario de manera más flexible
        let userLoc = window.userLocation || window.userMarker?.getLatLng();
        
        if (!userLoc) {
            // Intentar obtener ubicación automáticamente
            if (navigator.geolocation) {
                const confirmed = confirm('No tienes ubicación establecida. ¿Quieres usar tu ubicación actual?');
                if (confirmed) {
                    try {
                        const position = await new Promise((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject);
                        });
                        
                        userLoc = {
                            lat: position.coords.latitude,
                            lon: position.coords.longitude
                        };
                        
                        // Guardar globalmente
                        window.userLocation = userLoc;
                        
                        // Crear marcador visual
                        if (typeof map !== 'undefined' && !window.userMarker) {
                            window.userMarker = L.marker([userLoc.lat, userLoc.lon], {
                                icon: L.divIcon({
                                    className: 'user-marker',
                                    html: '<div style="background: #667eea; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 3px rgba(102,126,234,0.3);"></div>',
                                    iconSize: [20, 20]
                                })
                            }).addTo(map);
                            
                            window.userMarker.bindPopup('<strong>📍 Tu ubicación</strong>');
                        }
                        
                    } catch (error) {
                        console.error('Error getting location:', error);
                        alert('No se pudo obtener tu ubicación. Haz click en "Usar Mi Ubicación" primero.');
                        return;
                    }
                } else {
                    alert('Necesito tu ubicación para calcular rutas. Haz click en "Usar Mi Ubicación"');
                    return;
                }
            } else {
                alert('Tu navegador no soporta geolocalización. Haz click en "Usar Mi Ubicación"');
                return;
            }
        }

        console.log('🧮 Calculating routes...');
        console.log('Origin:', userLoc);
        console.log('Destination:', this.state.selectedDestination);

        // Mostrar notificación
        if (typeof showNotification === 'function') {
            showNotification('Calculando mejores rutas...', 'info');
        }

        // Mostrar loading en el popup
        if (this.state.tempMarker) {
            this.state.tempMarker.setPopupContent(`
                <div style="text-align:center; padding:20px;">
                    <i class="fas fa-spinner fa-spin fa-2x" style="color:#667eea;"></i><br>
                    <strong style="margin-top:10px; display:block;">Calculando rutas...</strong>
                    <small>Esto puede tardar unos segundos</small>
                </div>
            `);
        }

        try {
            // Llamar al motor de routing
            const result = await this.calculateSmartRoutes(userLoc, this.state.selectedDestination);

            // Mostrar resultados
            this.displayRouteComparison(result);

        } catch (error) {
            console.error('❌ Error calculating routes:', error);
            
            if (typeof showNotification === 'function') {
                showNotification('Error calculando rutas: ' + error.message, 'error');
            } else {
                alert('Error calculando rutas: ' + error.message);
            }
            
            // Restaurar popup
            if (this.state.tempMarker) {
                const dest = this.state.selectedDestination;
                this.state.tempMarker.setPopupContent(`
                    <div style="text-align:center;">
                        <strong style="font-size:16px;">${dest.name}</strong><br>
                        <small>${dest.description || ''}</small><br>
                        <button onclick="DestinationPicker.calculateRoutes()" style="margin-top:10px; padding:8px 16px; background:linear-gradient(135deg,#667eea,#764ba2); color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">
                            ✨ Calcular Rutas
                        </button>
                    </div>
                `);
            }
        }
    },

    // ===== CALCULAR RUTAS INTELIGENTES =====
    async calculateSmartRoutes(origin, destination) {
        // Por ahora llamamos al sistema existente
        // TODO: Implementar lógica completa de "conducir directo vs aparcar antes"
        
        // Buscar parkings viables entre origen y destino
        const viableParkings = this.findParkingsOnRoute(origin, destination);
        
        const options = [];

        // OPCIÓN 1: Conducir directo al destino
        options.push(await this.calculateDirectDriveOption(origin, destination));

        // OPCIÓN 2-3: Parkings intermedios + Bici
        for (const parking of viableParkings.slice(0, 2)) {
            const option = await RoutingEngine.calculateMultimodalOptions(
                parking,
                destination,
                allStations,
                {}
            );
            if (option && option.options) {
                options.push(...option.options);
            }
        }

        return {
            origin,
            destination,
            options: options.slice(0, 3), // Top 3
            calculatedAt: new Date().toISOString()
        };
    },

    // ===== CALCULAR OPCIÓN COCHE DIRECTO =====
    async calculateDirectDriveOption(origin, destination) {
        const route = await RoutingEngine.fetchRoute('driving-car', origin, destination);
        
        const searchTime = this.state.selectedDestination.estimatedSearchTime || 5;
        
        return {
            type: 'drive_direct',
            name: '🚗 Conducir Directo',
            totalTime: (route.duration / 60) + searchTime,
            totalCost: 2.50 * 3, // Parking centro
            totalDistance: route.distance / 1000,
            co2Saved: 0,
            route: route,
            warning: `⚠️ Tiempo incluye ${searchTime} min buscando parking`,
            steps: [
                `Conducir ${(route.distance / 1000).toFixed(2)} km al destino (${Math.round(route.duration / 60)} min)`,
                `Buscar parking en zona (+${searchTime} min estimado)`,
                `Coste parking: 2.50€/h × 3h = 7.50€`
            ]
        };
    },

    // ===== ENCONTRAR PARKINGS EN RUTA =====
    findParkingsOnRoute(origin, destination) {
        if (!allParkings || allParkings.length === 0) return [];

        return allParkings
            .filter(p => {
                const freeSpots = p.current_status?.free_spots || p.free_spots || 0;
                return freeSpots >= 10;
            })
            .map(p => {
                const lat = p.location?.lat || p.lat;
                const lon = p.location?.lon || p.lon;
                const distFromOrigin = RoutingEngine.haversineDistance(origin.lat, origin.lon, lat, lon);
                const distToDestination = RoutingEngine.haversineDistance(lat, lon, destination.lat, destination.lon);
                
                return {
                    ...p,
                    distFromOrigin,
                    distToDestination,
                    isOnRoute: distFromOrigin < 5000 && distToDestination < 3000
                };
            })
            .filter(p => p.isOnRoute)
            .sort((a, b) => a.distToDestination - b.distToDestination);
    },

    // ===== MOSTRAR COMPARATIVA =====
    displayRouteComparison(result) {
        // Usar panel existente multimodal o crear uno nuevo
        console.log('📊 Displaying route comparison:', result);
        
        // Por ahora, mostrar en consola y llamar a sistema existente
        // TODO: Crear panel de comparativa visual
        
        showNotification(`${result.options.length} opciones calculadas`, 'success');
    }
};

// ===== ESTILOS CSS PARA EL MODAL =====
const destinationPickerStyles = `
<style>
.destination-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3000;
    animation: fadeIn 0.3s;
}

.destination-modal-content {
    background: white;
    border-radius: 16px;
    width: 90%;
    max-width: 700px;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
}

.destination-modal-header {
    padding: 24px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.destination-modal-header h2 {
    margin: 0;
    font-size: 24px;
}

.btn-close-modal {
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 20px;
    transition: background 0.2s;
}

.btn-close-modal:hover {
    background: rgba(255,255,255,0.3);
}

.destination-modal-body {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
}

.destination-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    border-bottom: 2px solid #eee;
}

.tab-btn {
    flex: 1;
    padding: 12px 16px;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    font-weight: 600;
    color: #666;
    transition: all 0.2s;
}

.tab-btn:hover {
    color: #667eea;
}

.tab-btn.active {
    color: #667eea;
    border-bottom-color: #667eea;
}

.predefined-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
}

.dest-card {
    border: 2px solid #eee;
    border-radius: 12px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.2s;
}

.dest-card:hover {
    border-color: #667eea;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.dest-icon {
    font-size: 36px;
    text-align: center;
    margin-bottom: 8px;
}

.dest-info strong {
    display: block;
    font-size: 14px;
    margin-bottom: 4px;
}

.dest-category {
    display: inline-block;
    font-size: 11px;
    background: #667eea;
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    margin-bottom: 8px;
}

.dest-info small {
    display: block;
    color: #999;
    font-size: 12px;
}

.search-box {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
}

.search-box input {
    flex: 1;
    padding: 12px;
    border: 2px solid #eee;
    border-radius: 8px;
    font-size: 14px;
}

.search-box button {
    padding: 12px 24px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
}

.search-results, .history-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.search-result-item, .history-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid #eee;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.search-result-item:hover, .history-item:hover {
    background: #f5f5f5;
    border-color: #667eea;
}

.map-instructions {
    text-align: center;
    padding: 60px 20px;
}

.map-instructions i {
    color: #667eea;
    margin-bottom: 20px;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
</style>
`;

// Inyectar estilos
if (typeof document !== 'undefined') {
    document.head.insertAdjacentHTML('beforeend', destinationPickerStyles);
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.DestinationPicker = DestinationPicker;
}

console.log('✅ Destination Picker module loaded');
