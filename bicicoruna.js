/* ===================================================== 
   CONFIGURACIÓN BICICORU\u00d1A PREMIUM
   ===================================================== */

const CONFIG = {
    apiUrl: 'http://localhost:5678/webhook/bicicoruna',
    parkingsUrl: 'http://localhost:5678/webhook/parkings',
    updateInterval: 120000,
    mapCenter: [43.3623, -8.4115],
    mapZoom: 13,
    defaultDestination: {
        name: 'Obelisco (Centro)',
        lat: 43.3715,
        lon: -8.3962
    }
};

/* ===================================================== 
   VARIABLES GLOBALES
   ===================================================== */

let map;
let stationMarkers = {};
let allStations = [];
let parkingMarkers = {};
let allParkings = [];
let markersLayer;
let darkMode = localStorage.getItem('darkMode') === 'true' || false;
let updateTimer;
let lightTiles;
let darkTiles;
let userLocation = null;


/* ===================================================== 
   INICIALIZACIÓN
   ===================================================== */

document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    initMap();
    initEventListeners();
    fetchStations();
    fetchParkings(); // ← NUEVO
    startAutoUpdate();
});

/* ===================================================== 
   TEMA (DARK MODE)
   ===================================================== */

function initTheme() {
    if (darkMode) {
        document.body.classList.add('dark-mode');
    }
}

function toggleDarkMode() {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', darkMode);
    
    if (darkMode) {
        map.removeLayer(lightTiles);
        map.addLayer(darkTiles);
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i> Modo Claro';
        showNotification('Modo oscuro activado 🌙', 'info');
    } else {
        map.removeLayer(darkTiles);
        map.addLayer(lightTiles);
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-moon"></i> Modo Oscuro';
        showNotification('Modo claro activado ☀️', 'info');
    }
}

/* ===================================================== 
   INICIALIZACIÓN DEL MAPA
   ===================================================== */

function initMap() {
    map = L.map('map').setView(CONFIG.mapCenter, CONFIG.mapZoom);
    
    lightTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap | BiciCoruña',
        maxZoom: 19
    }).addTo(map);
    
    darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap, © CartoDB | BiciCoruña',
        maxZoom: 19
    });
    
    if (darkMode) {
        map.removeLayer(lightTiles);
        map.addLayer(darkTiles);
    }
    
    markersLayer = L.layerGroup().addTo(map);
    
    console.log('🗺️ Mapa inicializado');
}

/* ===================================================== 
   EVENT LISTENERS
   ===================================================== */

function initEventListeners() {
    // Botones principales
    document.getElementById('refreshBtn').addEventListener('click', function(e) {
        e.preventDefault();
        fetchStations();
    });
    
    document.getElementById('themeToggle').addEventListener('click', function(e) {
        e.preventDefault();
        toggleDarkMode();
    });
    
    document.getElementById('aboutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('aboutModal').style.display = 'block';
    });
    
    // Modal
    document.querySelector('.close').addEventListener('click', function() {
        document.getElementById('aboutModal').style.display = 'none';
    });
    
    window.addEventListener('click', function(e) {
        const modal = document.getElementById('aboutModal');
        if (e.target == modal) {
            modal.style.display = 'none';
        }
    });
    
    // Filtros
    document.getElementById('showHigh').addEventListener('change', applyFilters);
    document.getElementById('showMedium').addEventListener('change', applyFilters);
    document.getElementById('showLow').addEventListener('change', applyFilters);
    document.getElementById('showInactive').addEventListener('change', applyFilters);
    
    // Controles del mapa
    document.getElementById('centerMap').addEventListener('click', function() {
        map.setView(CONFIG.mapCenter, CONFIG.mapZoom);
        showNotification('Mapa centrado en A Coruña 🗺️', 'info');
    });
    
    document.getElementById('fullScreen').addEventListener('click', function() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {
                showNotification('No se pudo entrar en pantalla completa', 'error');
            });
        } else {
            document.exitFullscreen();
        }
    });
    
    // Geolocalización
    document.getElementById('useMyLocation').addEventListener('click', getMyLocation);
    document.getElementById('bikeTypeFilter').addEventListener('change', function() {
        if (userLocation) {
            findNearbyBikes();
        }
    });
}

/* ===================================================== 
   OBTENER DATOS DE ESTACIONES
   ===================================================== */

async function fetchStations() {
    try {
        showLoading(true);
        updateRefreshButton(true);
        
        const response = await fetch(CONFIG.apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.stations && Array.isArray(data.stations)) {
            allStations = data.stations;
            
            const validStations = allStations.filter(s => s.lat && s.lon && s.name);
            
            updateMapAndStats(validStations);
            showNotification(`✅ ${validStations.length} estaciones actualizadas`, 'success');
        } else {
            throw new Error('Formato de respuesta inesperado');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        showError('Error al conectar con el servidor. Verifica que n8n esté ejecutándose.');
    } finally {
        showLoading(false);
        updateRefreshButton(false);
    }
}

/* ===================================================== 
   ACTUALIZAR MAPA Y ESTADÍSTICAS
   ===================================================== */

function updateMapAndStats(stations) {
    updateMap(stations);
    updateStats(stations);
    updateAdvancedStats(stations);
    updateLastUpdateTime();
}

function updateMap(stations) {
    markersLayer.clearLayers();
    stationMarkers = {};
    
    stations.forEach(station => {
        const marker = createStationMarker(station);
        if (marker) {
            markersLayer.addLayer(marker);
            stationMarkers[station.station_id] = marker;
        }
    });
    
    applyFilters();
}

/**
 * Actualizar marcadores de estaciones (VERSIÓN OPTIMIZADA SIN RECARGAR)
 * Solo actualiza los números, no recrea los marcadores
 */
function updateStationMarkers(stations) {
    console.log('🔄 Updating station markers (incremental mode)...');
    
    const existingStationIds = Object.keys(stationMarkers);
    const newStationIds = stations.map(s => s.station_id);
    
    // PASO 1: Actualizar marcadores existentes (sin recrearlos)
    stations.forEach(station => {
        const markerId = station.station_id;
        
        if (stationMarkers[markerId]) {
            // ✅ MARCADOR YA EXISTE → Solo actualizar contenido
            updateExistingStationMarker(stationMarkers[markerId], station);
        } else {
            // ➕ MARCADOR NUEVO → Crear
            const marker = createStationMarker(station);
            if (marker) {
                marker.addTo(map);
                stationMarkers[markerId] = marker;
                console.log(`➕ Nueva estación: ${station.name}`);
            }
        }
    });
    
    // PASO 2: Eliminar marcadores de estaciones que ya no existen
    const stationsToRemove = existingStationIds.filter(id => !newStationIds.includes(id));
    stationsToRemove.forEach(id => {
        if (stationMarkers[id]) {
            map.removeLayer(stationMarkers[id]);
            delete stationMarkers[id];
            console.log(`➖ Estación eliminada: ${id}`);
        }
    });
    
    console.log(`✅ Markers updated: ${newStationIds.length} active`);
}

/**
 * Actualizar un marcador existente SIN recrearlo
 * Solo cambia el número y el popup si cambiaron los datos
 */
function updateExistingStationMarker(marker, newData) {
    const oldData = marker._stationData || {};
    
    // Comparar si cambió algo importante
    const bikesChanged = oldData.num_bikes_available !== newData.num_bikes_available;
    const ebikesChanged = oldData.num_ebikes_available !== newData.num_ebikes_available;
    const docksChanged = oldData.num_docks_available !== newData.num_docks_available;
    
    if (!bikesChanged && !ebikesChanged && !docksChanged) {
        // No cambió nada → skip
        return;
    }
    
    // Guardar nuevos datos en el marcador
    marker._stationData = newData;
    
    // ACTUALIZAR ÍCONO (número de bicis)
    const bikes = newData.num_bikes_available || 0;
    let color = '#28a745'; // Verde
    if (bikes === 0) color = '#dc3545'; // Rojo
    else if (bikes <= 2) color = '#ffc107'; // Amarillo
    
    // Obtener el div del ícono y actualizar solo el número
    const iconElement = marker.getElement();
    if (iconElement) {
        const numberDiv = iconElement.querySelector('div');
        if (numberDiv) {
            // Animación de cambio
            numberDiv.style.transition = 'all 0.3s ease';
            numberDiv.style.transform = 'scale(1.2)';
            numberDiv.style.background = color;
            numberDiv.textContent = bikes;
            
            setTimeout(() => {
                numberDiv.style.transform = 'scale(1)';
            }, 300);
        }
    }
    
    // ACTUALIZAR POPUP (solo si está abierto)
    const popup = marker.getPopup();
    if (popup && marker.isPopupOpen()) {
        const newPopupContent = createStationPopupContent(newData);
        popup.setContent(newPopupContent);
    }
}

/**
 * Crear contenido del popup (refactorizado para reutilizar)
 */
function createStationPopupContent(station) {
    const bikes = station.num_bikes_available || 0;
    const ebikes = station.num_ebikes_available || 0;
    const docks = station.num_docks_available || 0;
    
    let color = '#28a745';
    if (bikes === 0) color = '#dc3545';
    else if (bikes <= 2) color = '#ffc107';
    
    return `
        <div style="font-family: Arial; min-width: 220px;">
            <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #333;">${station.name}</h3>
            <p style="color: #666; font-size: 12px; margin: 0 0 12px 0;">${station.address}</p>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px;">
                <div style="background: #f5f5f5; padding: 10px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 20px; font-weight: bold; color: ${color};">${bikes}</div>
                    <div style="font-size: 11px; color: #666;">bicis normales</div>
                </div>
                <div style="background: #f5f5f5; padding: 10px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 20px; font-weight: bold; color: #667eea;">⚡${ebikes}</div>
                    <div style="font-size: 11px; color: #666;">eléctricas</div>
                </div>
            </div>
            <div style="font-size: 13px; color: #666;">
                <div style="margin-bottom: 6px;"><strong>Huecos libres:</strong> ${docks}</div>
                <div><strong>Capacidad:</strong> ${station.capacity}</div>
            </div>
        </div>
    `;
}

/**
 * Modificar createStationMarker para guardar datos
 */
function createStationMarker(station) {
    if (!station.lat || !station.lon) return null;
    
    const bikes = station.num_bikes_available || 0;
    
    let color = '#28a745';
    if (bikes === 0) color = '#dc3545';
    else if (bikes <= 2) color = '#ffc107';
    
    const icon = L.divIcon({
        className: 'custom-bike-marker',
        html: `
            <div style="background: ${color}; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); border: 3px solid white; transition: all 0.3s ease;">
                ${bikes}
            </div>
        `,
        iconSize: [40, 40]
    });
    
    const marker = L.marker([station.lat, station.lon], { icon });
    
    // 🔑 GUARDAR DATOS EN EL MARCADOR
    marker._stationData = station;
    
    const popupContent = createStationPopupContent(station);
    marker.bindPopup(popupContent, { maxWidth: 300 });
    
    return marker;
}

/* ===================================================== 
   PARKINGS - NUEVA FUNCIONALIDAD
===================================================== */



// Función para obtener datos de parkings
async function fetchParkings() {
    console.log('🔄 Intentando obtener parkings desde API...');
    
    try {
        const response = await fetch('http://localhost:5678/webhook/parkings', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        console.log('📡 Respuesta API parkings:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('📦 Datos parkings recibidos:', data);

        if (!data.success) {
            console.error('❌ API respondió con success: false');
            return;
        }
        
        if (!data.parkings || !Array.isArray(data.parkings)) {
            console.error('❌ data.parkings no es un array:', data);
            return;
        }
        
        console.log(`✅ ${data.parkings.length} parkings recibidos de la API`);
        
        // Verificar estructura del primer parking
        if (data.parkings.length > 0) {
            const firstParking = data.parkings[0];
            console.log('🔍 Estructura primer parking:', {
                name: firstParking.name,
                hasLocation: !!firstParking.location,
                hasCurrentStatus: !!firstParking.current_status,
                locationStructure: firstParking.location,
                statusStructure: firstParking.current_status
            });
        }
        
        allParkings = data.parkings;
        updateParkingMarkers(allParkings);
        
        if (data.summary) {
            updateParkingStats(data.summary);
        }
        
    } catch (error) {
        console.error('❌ Error obteniendo parkings:', error);
        console.error('Stack trace:', error.stack);
    }
}


function updateParkingMarkers(parkings) {
    console.log(`🗺️ Actualizando marcadores para ${parkings.length} parkings`);
    
    // Limpiar marcadores antiguos
    Object.values(parkingMarkers).forEach(marker => {
        map.removeLayer(marker);
    });
    parkingMarkers = {};

    let successCount = 0;
    let errorCount = 0;

    parkings.forEach((parking, index) => {
        console.log(`➕ Procesando parking ${index + 1}/${parkings.length}: ${parking.name}`);
        
        const marker = createParkingMarker(parking);
        
        if (marker) {
            marker.addTo(map);
            parkingMarkers[parking.id] = marker;
            successCount++;
            console.log(`✅ Marcador ${parking.name} añadido al mapa`);
        } else {
            errorCount++;
            console.error(`❌ No se pudo crear marcador para ${parking.name}`);
        }
    });
    
    console.log(`📊 Resumen: ${successCount} marcadores creados, ${errorCount} errores`);
    console.log(`🗺️ Total marcadores en mapa: ${Object.keys(parkingMarkers).length}`);
}


function createParkingMarker(parking) {
    // VALIDACIÓN DE DATOS
    if (!parking) {
        console.error('❌ Parking es undefined');
        return null;
    }
    
    console.log('🔍 Procesando parking:', parking.name, parking);
    
    // Verificar que location existe
    if (!parking.location) {
        console.error('❌ parking.location no existe para:', parking.name);
        return null;
    }
    
    // Verificar que current_status existe
    if (!parking.current_status) {
        console.error('❌ parking.current_status no existe para:', parking.name);
        console.log('Estructura recibida:', Object.keys(parking));
        return null;
    }
    
    const status = parking.current_status;
    const freeSpots = status.free_spots || 0;
    const occupancyRate = status.occupancy_rate || 0;
    const capacity = parking.capacity || 0;
    
    console.log(`✅ Creando marcador para ${parking.name}: ${freeSpots} libres de ${capacity}`);
    
    // Determinar color según disponibilidad
    let markerColor = '#28a745'; // Verde
    if (status.status === 'full') {
        markerColor = '#dc3545'; // Rojo
    } else if (status.status === 'almost_full') {
        markerColor = '#ffc107'; // Amarillo
    } else if (status.status === 'limited') {
        markerColor = '#fd7e14'; // Naranja
    }
    
    const marker = L.marker([parking.location.lat, parking.location.lon], {
        icon: L.divIcon({
            className: 'custom-parking-marker',
            html: `
                <div class="parking-marker" style="background-color: ${markerColor}; width: 50px; height: 50px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 3px solid white;">
                    <div style="font-size: 20px;">🅿️</div>
                    <div style="font-size: 12px; font-weight: bold; color: white; margin-top: -2px;">${freeSpots}</div>
                </div>
            `,
            iconSize: [50, 50]
        })
    });
    
    // Popup con información del parking
    const popupContent = `
        <div class="parking-popup">
            <h3>${parking.name}</h3>
            <p class="address">${parking.address || 'Sin dirección'}</p>
            <div class="parking-stats">
                <div class="stat-row">
                    <span class="label">🅿️ Libres:</span>
                    <span class="value ${status.status === 'full' ? 'danger' : ''}">${freeSpots} / ${capacity}</span>
                </div>
                <div class="stat-row">
                    <span class="label">📊 Ocupación:</span>
                    <span class="value">${occupancyRate}%</span>
                </div>
                <div class="stat-row">
                    <span class="label">💶 Precio:</span>
                    <span class="value">${parking.price_per_hour?.toFixed(2) || 'N/A'}€/h</span>
                </div>
                <div class="stat-row">
                    <span class="label">📍 Al centro:</span>
                    <span class="value">${parking.distance_to_center || 'N/A'} km (${parking.walking_time || 'N/A'} min)</span>
                </div>
                <div class="stat-row">
                    <span class="label">⚠️ Riesgo:</span>
                    <span class="value risk-${status.risk}">${getRiskLabel(status.risk)}</span>
                </div>
            </div>
            <button onclick="showMultimodalOptions('${parking.id}')" class="btn-multimodal">
                🚴 Ver opción + Bici
            </button>
        </div>
    `;
    
    marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'parking-popup-container'
    });
    
    return marker;
}


function getRiskLabel(risk) {
    const labels = {
        'low': 'Bajo',
        'medium': 'Medio',
        'high': 'Alto'
    };
    return labels[risk] || risk;
}

function getOccupancyClass(rate, status) {
    if (status === 'inactive' || status === 'maintenance') return 'occupancy-inactive';
    if (rate >= 75) return 'occupancy-high';
    if (rate >= 25) return 'occupancy-medium';
    return 'occupancy-low';
}

/* ===================================================== 
   LÓGICA MULTIMODAL
===================================================== */

function showMultimodalOptions(parkingId) {
    const parking = allParkings.find(p => p.id === parkingId);
    if (!parking) return;
    
    // Buscar estación BiciCoruña más cercana al parking
    const nearestBikeStation = findNearestStation(
        parking.location.lat,
        parking.location.lon,
        allStations
    );
    
    if (!nearestBikeStation) {
        showNotification('No hay estaciones de BiciCoruña cercanas', 'warning');
        return;
    }
    
    // Calcular opciones
    const options = calculateMultimodalOptions(parking, nearestBikeStation);
    
    // Mostrar panel
    displayMultimodalPanel(parking, nearestBikeStation, options);
}

function findNearestStation(lat, lon, stations) {
    let nearest = null;
    let minDistance = Infinity;
    
    stations.forEach(station => {
        if (station.num_bikes_available === 0 || !station.is_renting) return;
        
        const distance = calculateDistance(lat, lon, station.lat, station.lon);
        
        if (distance < minDistance) {
            minDistance = distance;
            nearest = {...station, distanceFromParking: distance};
        }
    });
    
    return nearest;
}

function calculateMultimodalOptions(parking, bikeStation) {
    const DESTINATION = {name: 'Obelisco', lat: 43.3715, lon: -8.3962}; // Centro A Coruña
    
    // OPCIÓN A: Solo parking + caminar
    const optionWalk = {
        type: 'walk',
        totalTime: 5 + parking.walking_time, // 5 min buscar plaza + caminar
        totalCost: parking.price_per_hour * 3, // Asumimos 3h estancia
        co2: 0,
        steps: [
            `Aparcar en ${parking.name}`,
            `Caminar ${parking.distance_to_center} km al centro (${parking.walking_time} min)`
        ]
    };
    
    // OPCIÓN B: Parking + BiciCoruña
    const distanceBike = calculateDistance(
        bikeStation.lat,
        bikeStation.lon,
        DESTINATION.lat,
        DESTINATION.lon
    );
    const bikeTravelTime = distanceBike * 4; // 4 min/km en bici
    
    const optionBike = {
        type: 'bike',
        totalTime: 5 + 3 + bikeTravelTime, // buscar plaza + caminar a bici + pedalear
        totalCost: (parking.price_per_hour * 3) + 0.50, // +0.50€ BiciCoruña
        co2Saved: 150, // gramos CO2 vs buscar parking en centro
        ebikesAvailable: bikeStation.num_ebikes_available,
        normalBikesAvailable: bikeStation.num_bikes_available - bikeStation.num_ebikes_available,
        steps: [
            `Aparcar en ${parking.name} (${parking.current_status.free_spots} plazas libres)`,
            `Caminar 2 min a estación ${bikeStation.name}`,
            `Coger bici ${bikeStation.num_ebikes_available > 0 ? 'eléctrica ⚡' : ''}`,
            `Pedalear ${Math.round(distanceBike * 10) / 10} km al centro (${Math.round(bikeTravelTime)} min)`
        ]
    };
    
    // Calcular ahorro
    const timeSaved = optionWalk.totalTime - optionBike.totalTime;
    const moneySaved = optionWalk.totalCost - optionBike.totalCost;
    
    return {
        optionWalk,
        optionBike,
        savings: {
            time: timeSaved,
            money: moneySaved
        }
    };
}

function displayMultimodalPanel(parking, bikeStation, options) {
    const panel = document.getElementById('multimodalPanel');
    const content = document.getElementById('multimodalContent');
    
    const html = `
        <div class="option-card recommended">
            <div class="option-header">
                <h4>🚴 Recomendada: Parking + Bici</h4>
                <span class="badge">Ahorra ${Math.abs(Math.round(options.savings.time))} min</span>
            </div>
            <div class="option-body">
                <div class="metrics">
                    <div class="metric">
                        <span class="icon">⏱️</span>
                        <span class="value">${Math.round(options.optionBike.totalTime)} min</span>
                        <span class="label">Tiempo total</span>
                    </div>
                    <div class="metric">
                        <span class="icon">💶</span>
                        <span class="value">${options.optionBike.totalCost.toFixed(2)}€</span>
                        <span class="label">Coste 3h</span>
                    </div>
                    <div class="metric">
                        <span class="icon">🌱</span>
                        <span class="value">${options.optionBike.co2Saved}g</span>
                        <span class="label">CO2 ahorrado</span>
                    </div>
                </div>
                <div class="steps">
                    <h5>Pasos:</h5>
                    <ol>
                        ${options.optionBike.steps.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                </div>
                <div class="availability">
                    <p>🚴 ${options.optionBike.normalBikesAvailable} bicis normales</p>
                    <p>⚡ ${options.optionBike.ebikesAvailable} bicis eléctricas</p>
                </div>
            </div>
        </div>
        
        <div class="option-card alternative">
            <div class="option-header">
                <h4>🚶 Alternativa: Solo Caminar</h4>
            </div>
            <div class="option-body">
                <div class="metrics">
                    <div class="metric">
                        <span class="icon">⏱️</span>
                        <span class="value">${Math.round(options.optionWalk.totalTime)} min</span>
                        <span class="label">Tiempo total</span>
                    </div>
                    <div class="metric">
                        <span class="icon">💶</span>
                        <span class="value">${options.optionWalk.totalCost.toFixed(2)}€</span>
                        <span class="label">Coste 3h</span>
                    </div>
                </div>
            </div>
        </div>
        
        <button onclick="selectMultimodalOption('bike')" class="btn-select">
            Usar esta ruta 🚴
        </button>
    `;
    
    content.innerHTML = html;
    panel.classList.add('active');
    
    // Dibujar ruta en el mapa
    drawMultimodalRoute(parking, bikeStation);
}

function closeMultimodalPanel() {
    document.getElementById('multimodalPanel').classList.remove('active');
    // Limpiar rutas del mapa
    if (window.currentRoute) {
        map.removeLayer(window.currentRoute);
    }
}

function drawMultimodalRoute(parking, bikeStation) {
    // Limpiar ruta anterior
    if (window.currentRoute) {
        map.removeLayer(window.currentRoute);
    }
    
    const DESTINATION = {lat: 43.3715, lon: -8.3962}; // Obelisco
    
    // Ruta: Parking → Estación bici → Destino
    const routeCoords = [
        [parking.location.lat, parking.location.lon],
        [bikeStation.lat, bikeStation.lon],
        [DESTINATION.lat, DESTINATION.lon]
    ];
    
    window.currentRoute = L.polyline(routeCoords, {
        color: '#32B8C6',
        weight: 4,
        opacity: 0.7,
        dashArray: '10, 10'
    }).addTo(map);
    
    // Centrar mapa en la ruta
    map.fitBounds(window.currentRoute.getBounds(), {padding: [50, 50]});
}

function createPopupContent(station) {
    const normalBikes = station.num_bikes_available - station.num_ebikes_available;
    
    return `
        <div class="popup-content">
            <h4>${station.name}</h4>
            <div class="popup-row">
                <span>🚲 Normales: ${normalBikes}</span>
                <span>⚡ Eléctricas: ${station.num_ebikes_available}</span>
            </div>
            <div class="popup-row">
                <span>🅿️ Huecos: ${station.num_docks_available}</span>
                <span>📊 ${station.occupancy_rate}%</span>
            </div>
            ${station.address ? `<div class="popup-address">📍 ${station.address}</div>` : ''}
        </div>
    `;
}

/* ===================================================== 
   ESTADÍSTICAS BÁSICAS
   ===================================================== */

function updateStats(stations) {
    if (!stations || stations.length === 0) return;
    
    const stats = calculateStats(stations);
    
    document.getElementById('activeStations').textContent = stats.activeStations;
    document.getElementById('availableBikes').textContent = stats.totalBikes;
    document.getElementById('availableDocks').textContent = stats.totalDocks;
    document.getElementById('avgOccupancy').textContent = `${stats.avgOccupancy}%`;
}

function calculateStats(stations) {
    let activeStations = 0;
    let totalBikes = 0;
    let totalDocks = 0;
    let totalCapacity = 0;
    
    stations.forEach(station => {
        const bikes = parseInt(station.num_bikes_available) || 0;
        const docks = parseInt(station.num_docks_available) || 0;
        const capacity = parseInt(station.capacity) || 0;
        
        if (station.is_renting && station.is_installed) {
            activeStations++;
        }
        
        totalBikes += bikes;
        totalDocks += docks;
        totalCapacity += capacity;
    });
    
    const avgOccupancy = totalCapacity > 0 
        ? ((totalBikes / totalCapacity) * 100).toFixed(1)
        : 0;
    
    return {
        totalStations: stations.length,
        activeStations,
        totalBikes,
        totalDocks,
        avgOccupancy
    };
}

/* ===================================================== 
   ESTADÍSTICAS AVANZADAS
   ===================================================== */

function updateAdvancedStats(stations) {
    if (!stations || stations.length === 0) return;
    
    let totalNormalBikes = 0;
    let totalElectricBikes = 0;
    let totalFreeDocks = 0;
    let emptyStations = 0;
    
    stations.forEach(station => {
        const normalBikes = station.num_bikes_available - station.num_ebikes_available;
        totalNormalBikes += normalBikes;
        totalElectricBikes += station.num_ebikes_available || 0;
        totalFreeDocks += station.num_docks_available || 0;
        
        if (station.num_bikes_available === 0 && station.is_renting) {
            emptyStations++;
        }
    });
    
    document.getElementById('normalBikes').textContent = totalNormalBikes;
    document.getElementById('electricBikes').textContent = totalElectricBikes;
    document.getElementById('totalFreeDocks').textContent = totalFreeDocks;
    document.getElementById('emptyStationsCount').textContent = emptyStations;
    
    updateTopStations(stations);
}

function updateTopStations(stations) {
    const sorted = [...stations]
        .filter(s => s.is_renting && s.num_bikes_available > 0)
        .sort((a, b) => b.num_bikes_available - a.num_bikes_available)
        .slice(0, 5);
    
    const html = sorted.map(station => {
        const normalBikes = station.num_bikes_available - station.num_ebikes_available;
        return `
            <div class="station-item" onclick="flyToStation(${station.lat}, ${station.lon}, '${station.name}')">
                <div class="name">${station.name}</div>
                <div class="bikes">
                    <span><i class="fas fa-bicycle"></i> ${normalBikes}</span>
                    <span><i class="fas fa-bolt"></i> ${station.num_ebikes_available}</span>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('topStationsList').innerHTML = html || '<p>No hay datos</p>';
}

function flyToStation(lat, lon, name) {
    map.setView([lat, lon], 17);
    showNotification(`📍 ${name}`, 'info');
}


/* ===================================================== 
   LÓGICA MULTIMODAL
===================================================== */

function showMultimodalOptions(parkingId) {
    const parking = allParkings.find(p => p.id === parkingId);
    if (!parking) return;
    
    // Buscar estación BiciCoruña más cercana al parking
    const nearestBikeStation = findNearestStation(
        parking.location.lat,
        parking.location.lon,
        allStations
    );
    
    if (!nearestBikeStation) {
        showNotification('No hay estaciones de BiciCoruña cercanas', 'warning');
        return;
    }
    
    // Calcular opciones
    const options = calculateMultimodalOptions(parking, nearestBikeStation);
    
    // Mostrar panel
    displayMultimodalPanel(parking, nearestBikeStation, options);
}

function findNearestStation(lat, lon, stations) {
    let nearest = null;
    let minDistance = Infinity;
    
    stations.forEach(station => {
        if (station.num_bikes_available === 0 || !station.is_renting) return;
        
        const distance = calculateDistance(lat, lon, station.lat, station.lon);
        
        if (distance < minDistance) {
            minDistance = distance;
            nearest = {...station, distanceFromParking: distance};
        }
    });
    
    return nearest;
}

function calculateMultimodalOptions(parking, bikeStation) {
    const DESTINATION = {name: 'Obelisco', lat: 43.3715, lon: -8.3962}; // Centro A Coruña
    
    // OPCIÓN A: Solo parking + caminar
    const optionWalk = {
        type: 'walk',
        totalTime: 5 + parking.walking_time, // 5 min buscar plaza + caminar
        totalCost: parking.price_per_hour * 3, // Asumimos 3h estancia
        co2: 0,
        steps: [
            `Aparcar en ${parking.name}`,
            `Caminar ${parking.distance_to_center} km al centro (${parking.walking_time} min)`
        ]
    };
    
    // OPCIÓN B: Parking + BiciCoruña
    const distanceBike = calculateDistance(
        bikeStation.lat,
        bikeStation.lon,
        DESTINATION.lat,
        DESTINATION.lon
    );
    const bikeTravelTime = distanceBike * 4; // 4 min/km en bici
    
    const optionBike = {
        type: 'bike',
        totalTime: 5 + 3 + bikeTravelTime, // buscar plaza + caminar a bici + pedalear
        totalCost: (parking.price_per_hour * 3) + 0.50, // +0.50€ BiciCoruña
        co2Saved: 150, // gramos CO2 vs buscar parking en centro
        ebikesAvailable: bikeStation.num_ebikes_available,
        normalBikesAvailable: bikeStation.num_bikes_available - bikeStation.num_ebikes_available,
        steps: [
            `Aparcar en ${parking.name} (${parking.current_status.free_spots} plazas libres)`,
            `Caminar 2 min a estación ${bikeStation.name}`,
            `Coger bici ${bikeStation.num_ebikes_available > 0 ? 'eléctrica ⚡' : ''}`,
            `Pedalear ${Math.round(distanceBike * 10) / 10} km al centro (${Math.round(bikeTravelTime)} min)`
        ]
    };
    
    // Calcular ahorro
    const timeSaved = optionWalk.totalTime - optionBike.totalTime;
    const moneySaved = optionWalk.totalCost - optionBike.totalCost;
    
    return {
        optionWalk,
        optionBike,
        savings: {
            time: timeSaved,
            money: moneySaved
        }
    };
}

function displayMultimodalPanel(parking, bikeStation, options) {
    const panel = document.getElementById('multimodalPanel');
    const content = document.getElementById('multimodalContent');
    
    const html = `
        <div class="option-card recommended">
            <div class="option-header">
                <h4>🚴 Recomendada: Parking + Bici</h4>
                <span class="badge">Ahorra ${Math.abs(Math.round(options.savings.time))} min</span>
            </div>
            <div class="option-body">
                <div class="metrics">
                    <div class="metric">
                        <span class="icon">⏱️</span>
                        <span class="value">${Math.round(options.optionBike.totalTime)} min</span>
                        <span class="label">Tiempo total</span>
                    </div>
                    <div class="metric">
                        <span class="icon">💶</span>
                        <span class="value">${options.optionBike.totalCost.toFixed(2)}€</span>
                        <span class="label">Coste 3h</span>
                    </div>
                    <div class="metric">
                        <span class="icon">🌱</span>
                        <span class="value">${options.optionBike.co2Saved}g</span>
                        <span class="label">CO2 ahorrado</span>
                    </div>
                </div>
                <div class="steps">
                    <h5>Pasos:</h5>
                    <ol>
                        ${options.optionBike.steps.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                </div>
                <div class="availability">
                    <p>🚴 ${options.optionBike.normalBikesAvailable} bicis normales</p>
                    <p>⚡ ${options.optionBike.ebikesAvailable} bicis eléctricas</p>
                </div>
            </div>
        </div>
        
        <div class="option-card alternative">
            <div class="option-header">
                <h4>🚶 Alternativa: Solo Caminar</h4>
            </div>
            <div class="option-body">
                <div class="metrics">
                    <div class="metric">
                        <span class="icon">⏱️</span>
                        <span class="value">${Math.round(options.optionWalk.totalTime)} min</span>
                        <span class="label">Tiempo total</span>
                    </div>
                    <div class="metric">
                        <span class="icon">💶</span>
                        <span class="value">${options.optionWalk.totalCost.toFixed(2)}€</span>
                        <span class="label">Coste 3h</span>
                    </div>
                </div>
            </div>
        </div>
        
        <button onclick="selectMultimodalOption('bike')" class="btn-select">
            Usar esta ruta 🚴
        </button>
    `;
    
    content.innerHTML = html;
    panel.classList.add('active');
    
    // Dibujar ruta en el mapa
    drawMultimodalRoute(parking, bikeStation);
}

function closeMultimodalPanel() {
    document.getElementById('multimodalPanel').classList.remove('active');
    // Limpiar rutas del mapa
    if (window.currentRoute) {
        map.removeLayer(window.currentRoute);
    }
}

function drawMultimodalRoute(parking, bikeStation) {
    // Limpiar ruta anterior
    if (window.currentRoute) {
        map.removeLayer(window.currentRoute);
    }
    
    const DESTINATION = {lat: 43.3715, lon: -8.3962}; // Obelisco
    
    // Ruta: Parking → Estación bici → Destino
    const routeCoords = [
        [parking.location.lat, parking.location.lon],
        [bikeStation.lat, bikeStation.lon],
        [DESTINATION.lat, DESTINATION.lon]
    ];
    
    window.currentRoute = L.polyline(routeCoords, {
        color: '#32B8C6',
        weight: 4,
        opacity: 0.7,
        dashArray: '10, 10'
    }).addTo(map);
    
    // Centrar mapa en la ruta
    map.fitBounds(window.currentRoute.getBounds(), {padding: [50, 50]});
}

/* ===================================================== 
   GEOLOCALIZACIÓN
   ===================================================== */

function getMyLocation() {
    const btn = document.getElementById('useMyLocation');
    
    if (!navigator.geolocation) {
        showNotification('Tu navegador no soporta geolocalización', 'error');
        return;
    }
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Obteniendo...';
    btn.disabled = true;
    
    navigator.geolocation.getCurrentPosition(
        position => {
            userLocation = {
                lat: position.coords.latitude,
                lon: position.coords.longitude
            };
            
            if (window.userMarker) {
                map.removeLayer(window.userMarker);
            }
            
            window.userMarker = L.marker([userLocation.lat, userLocation.lon], {
                icon: L.divIcon({
                    className: 'user-marker',
                    html: '<div style="background: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
                    iconSize: [20, 20]
                })
            }).addTo(map);
            
            map.setView([userLocation.lat, userLocation.lon], 15);
            findNearbyBikes();
            
            btn.innerHTML = '<i class="fas fa-crosshairs"></i> Usar Mi Ubicación';
            btn.disabled = false;
            showNotification('Ubicación obtenida ✅', 'success');
        },
        error => {
            btn.innerHTML = '<i class="fas fa-crosshairs"></i> Usar Mi Ubicación';
            btn.disabled = false;
            showNotification('No se pudo obtener la ubicación', 'error');
        }
    );
}

function findNearbyBikes() {
    if (!userLocation || !allStations || allStations.length === 0) {
        document.getElementById('nearbyResults').innerHTML = '<p style="padding:10px;">Obtén tu ubicación primero</p>';
        return;
    }
    
    const bikeType = document.getElementById('bikeTypeFilter').value;
    
    const stationsWithDistance = allStations.map(station => {
        const distance = calculateDistance(
            userLocation.lat, userLocation.lon,
            station.lat, station.lon
        );
        return { ...station, distance };
    });
    
    let filtered = stationsWithDistance.filter(station => {
        if (!station.is_renting || !station.is_installed) return false;
        
        if (bikeType === 'electric') {
            return station.num_ebikes_available > 0;
        } else if (bikeType === 'normal') {
            return (station.num_bikes_available - station.num_ebikes_available) > 0;
        } else {
            return station.num_bikes_available > 0;
        }
    });
    
    filtered.sort((a, b) => a.distance - b.distance);
    
    const top5 = filtered.slice(0, 5);
    
    if (top5.length === 0) {
        document.getElementById('nearbyResults').innerHTML = '<p style="text-align:center; padding:20px;">No hay bicis disponibles cerca 😔</p>';
        return;
    }
    
    const html = top5.map(station => {
        const normalBikes = station.num_bikes_available - station.num_ebikes_available;
        return `
            <div class="nearby-item" onclick="flyToStation(${station.lat}, ${station.lon}, '${station.name}')">
                <div class="nearby-item-header">
                    <div class="nearby-item-name">${station.name}</div>
                    <div class="nearby-item-distance">${station.distance.toFixed(0)}m</div>
                </div>
                <div class="nearby-item-info">
                    <span><i class="fas fa-bicycle"></i> ${normalBikes}</span>
                    <span><i class="fas fa-bolt"></i> ${station.num_ebikes_available}</span>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('nearbyResults').innerHTML = html;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
}

/* ===================================================== 
   FILTROS
   ===================================================== */

function applyFilters() {
    const filters = {
        high: document.getElementById('showHigh').checked,
        medium: document.getElementById('showMedium').checked,
        low: document.getElementById('showLow').checked,
        inactive: document.getElementById('showInactive').checked
    };
    
    Object.values(stationMarkers).forEach(marker => {
        const element = marker.getElement();
        if (!element) return;
        
        const stationElement = element.querySelector('.station-marker');
        if (!stationElement) return;
        
        const classes = stationElement.className;
        let show = false;
        
        if (filters.high && classes.includes('occupancy-high')) show = true;
        if (filters.medium && classes.includes('occupancy-medium')) show = true;
        if (filters.low && classes.includes('occupancy-low')) show = true;
        if (filters.inactive && classes.includes('occupancy-inactive')) show = true;
        
        marker.setOpacity(show ? 1 : 0.3);
    });
}

/* ===================================================== 
   UTILIDADES DE UI
   ===================================================== */

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function updateRefreshButton(isRefreshing) {
    const btn = document.getElementById('refreshBtn');
    const icon = btn.querySelector('i');
    
    if (isRefreshing) {
        icon.className = 'fas fa-spinner fa-spin';
        btn.style.opacity = '0.6';
    } else {
        icon.className = 'fas fa-sync-alt';
        btn.style.opacity = '1';
    }
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = message;
    
    const iconMap = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'info': 'info-circle'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 90px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 14px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10002;
        font-size: 14px;
        max-width: 300px;
        animation: slideInRight 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3500);
}

function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES');
    document.getElementById('lastUpdate').textContent = `Última actualización: ${timeString}`;
}

/* ===================================================== 
   AUTO-ACTUALIZACIÓN
   ===================================================== */

function startAutoUpdate() {
    updateTimer = setInterval(() => {
        fetchStations();
        fetchParkings(); // ← NUEVO
    }, CONFIG.updateInterval);
}

function stopAutoUpdate() {
    if (updateTimer) {
        clearInterval(updateTimer);
    }
}

/* ===================================================== 
   ESTILOS DINÁMICOS PARA MARCADORES
   ===================================================== */

const style = document.createElement('style');
style.textContent = `
    .station-marker {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        font-weight: bold;
        color: white;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        font-size: 16px;
        transition: all 0.2s;
    }
    
    .station-marker:hover {
        transform: scale(1.15);
    }
    
    .occupancy-high {
        background: linear-gradient(135deg, #10b981, #059669);
    }
    
    .occupancy-medium {
        background: linear-gradient(135deg, #f59e0b, #d97706);
    }
    
    .occupancy-low {
        background: linear-gradient(135deg, #ef4444, #dc2626);
    }
    
    .occupancy-inactive {
        background: #9ca3af;
        opacity: 0.6;
    }
    
    .custom-popup .popup-content {
        padding: 10px;
        font-size: 13px;
    }
    
    .custom-popup h4 {
        margin: 0 0 8px 0;
        font-weight: 600;
        color: #007CC3;
    }
    
    .popup-row {
        display: flex;
        justify-content: space-between;
        margin: 4px 0;
        font-size: 12px;
    }
    
    .popup-address {
        margin-top: 8px;
        font-size: 11px;
        color: #666;
        border-top: 1px solid #eee;
        padding-top: 4px;
    }
`;

document.head.appendChild(style);

/* ===================================================== 
   CLEANUP
   ===================================================== */

window.addEventListener('beforeunload', function() {
    stopAutoUpdate();
});

window.addEventListener('offline', function() {
    showNotification('Conexión perdida', 'error');
    stopAutoUpdate();
});

window.addEventListener('online', function() {
    showNotification('Conexión restaurada', 'success');
    fetchStations();
    startAutoUpdate();
});

console.log('✅ BiciCoruña Premium cargado correctamente');