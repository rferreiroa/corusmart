/* =====================================================
   MULTIMODAL MODULE - Refactorizado con Routing Real
   BiciCoruña Premium v2.0

   Este módulo sobrescribe las funciones multimodales
   antiguas para usar RoutingEngine y ScoringEngine
   ===================================================== */

/**
 * Mostrar opciones multimodales para un parking
 * Versión 2.0 con rutas reales ORS
 */
async function showMultimodalOptions(parkingId) {
    // Guardar parkingId para uso en catch
    const currentParkingId = parkingId;

    const parking = allParkings.find(p => p.id === currentParkingId);
    if (!parking) {
        showNotification('❌ Parking no encontrado', 'error');
        return;
    }

    // Mostrar loading en panel
    const panel = document.getElementById('multimodalPanel');
    const content = document.getElementById('multimodalContent');

    content.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <i class="fas fa-spinner fa-spin fa-3x" style="color: var(--color-primary);"></i>
            <p style="margin-top: 20px; font-size: 14px;">Calculando rutas reales con OpenRouteService...</p>
            <p style="margin-top: 10px; font-size: 12px; color: var(--color-text-secondary);">Esto puede tardar unos segundos</p>
        </div>
    `;
    panel.classList.add('active');

    try {
        console.log('🔄 Calculating multimodal options for:', parking.name);

        // Usar RoutingEngine para calcular opciones con rutas REALES
        const result = await RoutingEngine.calculateMultimodalOptions(
            parking,
            CONFIG.defaultDestination,
            allStations,
            {} // Preferencias usuario (futuro)
        );

        console.log('✅ Routes calculated:', result.options.length, 'options');

        // Usar ScoringEngine para puntuar opciones
        const scoredOptions = ScoringEngine.scoreAllOptions(result.options, {
            parkingRisk: parking.current_status.risk
        });

        console.log('✅ Options scored');

        // Mostrar panel con scores
        displayMultimodalPanel(parking, scoredOptions);

    } catch (error) {
        console.error('❌ Error calculating multimodal options:', error);
        console.error('Stack:', error.stack);

        let errorMessage = 'Error desconocido';
        let errorDetails = '';

        if (error.message) {
            errorMessage = error.message;
        }

        // Mensajes específicos según el tipo de error
        if (error.message && error.message.includes('ORS API')) {
            errorDetails = 'OpenRouteService no está disponible. El sistema usará rutas estimadas.';
        } else if (error.message && error.message.includes('No routes')) {
            errorDetails = 'No se encontraron rutas disponibles. Intenta con otro parking.';
        } else if (error.message && error.message.includes('fetch')) {
            errorDetails = 'Problema de conexión. Verifica tu internet.';
        }

        content.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--color-error);">
                <i class="fas fa-exclamation-circle fa-3x" style="color: var(--color-error);"></i>
                <p style="margin-top: 20px; font-weight: 600; font-size: 16px;">${errorMessage}</p>
                ${errorDetails ? `<p style="margin-top: 10px; font-size: 13px; color: var(--color-text-secondary);">${errorDetails}</p>` : ''}
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
                    <button onclick="closeMultimodalPanel()" class="btn-select-option" style="width: auto; padding: 10px 20px;">
                        Cerrar
                    </button>
                    <button onclick="showMultimodalOptions('${currentParkingId}')" class="btn-select-option recommended" style="width: auto; padding: 10px 20px;">
                        Reintentar
                    </button>
                </div>
                <details style="margin-top: 20px; text-align: left; font-size: 12px; color: var(--color-text-secondary);">
                    <summary style="cursor: pointer;">Detalles técnicos</summary>
                    <pre style="margin-top: 10px; padding: 10px; background: var(--color-background); border-radius: 4px; overflow: auto; max-height: 200px;">${error.stack || error.message}</pre>
                </details>
            </div>
        `;
        showNotification('Error calculando rutas - Se usarán estimaciones', 'error');
    }
}

/**
 * Mostrar panel multimodal con opciones puntuadas
 */
function displayMultimodalPanel(parking, scoredOptions) {
    const panel = document.getElementById('multimodalPanel');
    const content = document.getElementById('multimodalContent');

    if (!scoredOptions || scoredOptions.length === 0) {
        content.innerHTML = '<p style="padding: 20px;">No hay opciones disponibles</p>';
        return;
    }

    // Generar HTML para cada opción
    const optionsHTML = scoredOptions.map((option, index) => {
        const badge = ScoringEngine.getScoreBadge(option.finalScore);
        const isRecommended = option.isRecommended;

        return `
            <div class="option-card ${isRecommended ? 'recommended' : 'alternative'}" data-option-index="${index}">
                <div class="option-header">
                    <div class="option-title">
                        <h4>${option.name}</h4>
                        ${isRecommended ? '<span class="recommended-badge">🏆 Recomendada</span>' : ''}
                    </div>
                    <div class="score-badge ${badge.class}" style="background-color: ${badge.color}20; border: 2px solid ${badge.color};">
                        <span class="score-icon">${badge.icon}</span>
                        <span class="score-value">${option.finalScore}</span>
                        <span class="score-label">/100</span>
                    </div>
                </div>

                <div class="option-body">
                    <!-- Métricas principales -->
                    <div class="metrics-grid">
                        <div class="metric">
                            <span class="metric-icon">⏱️</span>
                            <span class="metric-value">${Math.round(option.totalTime)} min</span>
                            <span class="metric-label">Tiempo</span>
                        </div>
                        <div class="metric">
                            <span class="metric-icon">💶</span>
                            <span class="metric-value">${option.totalCost.toFixed(2)}€</span>
                            <span class="metric-label">Coste</span>
                        </div>
                        <div class="metric">
                            <span class="metric-icon">📏</span>
                            <span class="metric-value">${option.totalDistance.toFixed(2)} km</span>
                            <span class="metric-label">Distancia</span>
                        </div>
                        <div class="metric">
                            <span class="metric-icon">🌱</span>
                            <span class="metric-value">${option.co2Saved}g</span>
                            <span class="metric-label">CO₂ ahorrado</span>
                        </div>
                    </div>

                    <!-- Desglose de scores -->
                    <div class="score-breakdown">
                        <h5 style="font-size: 13px; margin-bottom: 8px; color: var(--color-text-secondary);">
                            Desglose de puntuación:
                        </h5>
                        ${renderScoreBar('⏱️ Tiempo', option.scores.time, '#3b82f6')}
                        ${renderScoreBar('💶 Coste', option.scores.cost, '#10b981')}
                        ${renderScoreBar('🌱 Ecología', option.scores.eco, '#22c55e')}
                        ${renderScoreBar('🚴 Disponibilidad', option.scores.availability, '#f59e0b')}
                    </div>

                    <!-- Pasos de la ruta -->
                    <div class="route-steps">
                        <h5>📍 Ruta paso a paso:</h5>
                        <ol>
                            ${option.steps.map(step => `<li>${step}</li>`).join('')}
                        </ol>
                    </div>

                    <!-- Botón de selección -->
                    <button onclick="selectAndDrawRoute(${index}, ${JSON.stringify(scoredOptions).replace(/"/g, '&quot;')})"
                            class="btn-select-option ${isRecommended ? 'recommended' : ''}">
                        ${isRecommended ? '✅ Usar ruta recomendada' : '👉 Ver esta ruta'}
                    </button>
                </div>
            </div>
        `;
    }).join('');

    content.innerHTML = `
        <div class="multimodal-header">
            <h3>🗺️ Rutas Multimodales Disponibles</h3>
            <p style="font-size: 13px; color: var(--color-text-secondary); margin-top: 4px;">
                Desde <strong>${parking.name}</strong> a <strong>${CONFIG.defaultDestination.name}</strong>
            </p>
        </div>
        <div class="multimodal-options">
            ${optionsHTML}
        </div>
    `;

    // Guardar opciones en variable global para acceso posterior
    window.currentMultimodalOptions = scoredOptions;

    // Dibujar ruta de la opción recomendada por defecto
    const recommended = scoredOptions.find(o => o.isRecommended);
    if (recommended) {
        drawMultimodalRoute(recommended);
    }
}

/**
 * Helper: Renderizar barra de score
 */
function renderScoreBar(label, score, color) {
    return `
        <div class="score-item">
            <div class="score-item-header">
                <span class="score-item-label">${label}</span>
                <span class="score-item-value">${score}/100</span>
            </div>
            <div class="score-bar">
                <div class="score-fill" style="width: ${score}%; background: ${color};"></div>
            </div>
        </div>
    `;
}

/**
 * Seleccionar opción y dibujar su ruta
 */
function selectAndDrawRoute(optionIndex, optionsJSON) {
    // Recuperar opciones desde variable global
    const options = window.currentMultimodalOptions;
    if (!options || !options[optionIndex]) {
        console.error('Option not found');
        return;
    }

    const selectedOption = options[optionIndex];
    console.log(`✅ Usuario seleccionó: ${selectedOption.name}`);

    // Dibujar ruta
    drawMultimodalRoute(selectedOption);

    // Feedback visual
    showNotification(`Ruta seleccionada: ${selectedOption.name}`, 'success');

    // Resaltar opción seleccionada
    document.querySelectorAll('.option-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-option-index="${optionIndex}"]`).classList.add('selected');
}

/**
 * Dibujar ruta multimodal en el mapa
 */
function drawMultimodalRoute(option) {
    console.log('🗺️ Drawing route for:', option.name);
    console.log('📊 Option data:', option);

    // Limpiar rutas anteriores
    if (window.currentRoutes) {
        window.currentRoutes.forEach(layer => {
            try {
                map.removeLayer(layer);
            } catch (e) {
                // Ignorar si ya fue removido
            }
        });
    }
    window.currentRoutes = [];

    // Verificar que tenemos datos
    if (!option) {
        console.error('❌ No option provided');
        return;
    }

    if (option.type === 'walk') {
        // Solo una ruta caminando
        if (!option.route || !option.route.geometry || option.route.geometry.length === 0) {
            console.error('❌ No geometry for walk route');
            return;
        }

        console.log(`📍 Drawing walk route with ${option.route.geometry.length} points`);

        // Estilo diferente si es fallback
        const isFallback = option.route.isFallback;
        const routeStyle = {
            color: isFallback ? '#ef4444' : '#3b82f6',
            weight: 6,
            opacity: isFallback ? 0.6 : 0.85,
            lineJoin: 'round',
            lineCap: 'round',
            dashArray: isFallback ? '10, 10' : null
        };

        const polyline = L.polyline(option.route.geometry, routeStyle).addTo(map);

        // Añadir popup si es fallback
        if (isFallback) {
            polyline.bindPopup('⚠️ Ruta estimada (OpenRouteService no disponible)');
        }

        window.currentRoutes.push(polyline);

        // Añadir marcadores de inicio y fin
        const start = option.route.geometry[0];
        const end = option.route.geometry[option.route.geometry.length - 1];

        const startMarker = createRouteMarker(start, '🅿️', '#3b82f6', 'Parking');
        const endMarker = createRouteMarker(end, '🎯', '#10b981', 'Destino');

        startMarker.addTo(map);
        endMarker.addTo(map);

        window.currentRoutes.push(startMarker, endMarker);

    } else if (option.type === 'bike') {
        // Dos rutas: caminar a bici + bici a destino

        // Validar datos
        if (!option.routes || !option.routes.walkToBike || !option.routes.bikeToDestination) {
            console.error('❌ Missing routes data for bike option');
            console.log('Routes data:', option.routes);
            return;
        }

        // Ruta 1: Caminar a estación
        if (option.routes.walkToBike.geometry && option.routes.walkToBike.geometry.length > 0) {
            console.log(`📍 Drawing walk-to-bike route with ${option.routes.walkToBike.geometry.length} points`);

            const walkStyle = {
                color: '#9ca3af',
                weight: 5,
                opacity: 0.7,
                dashArray: '10, 5',
                lineJoin: 'round',
                lineCap: 'round'
            };

            const walkLine = L.polyline(option.routes.walkToBike.geometry, walkStyle).addTo(map);
            walkLine.bindPopup('🚶 Caminar a estación de bici');
            window.currentRoutes.push(walkLine);

            // Marcador parking
            const parkingPos = option.routes.walkToBike.geometry[0];
            const parkingMarker = createRouteMarker(parkingPos, '🅿️', '#3b82f6', 'Parking');
            parkingMarker.addTo(map);
            window.currentRoutes.push(parkingMarker);
        }

        // Ruta 2: Bici a destino
        if (option.routes.bikeToDestination.geometry && option.routes.bikeToDestination.geometry.length > 0) {
            console.log(`📍 Drawing bike route with ${option.routes.bikeToDestination.geometry.length} points`);

            const bikeColor = option.bikeType === 'electric' ? '#f59e0b' : '#10b981';
            const isFallback = option.routes.bikeToDestination.isFallback;

            const bikeStyle = {
                color: bikeColor,
                weight: 7,
                opacity: isFallback ? 0.6 : 0.9,
                lineJoin: 'round',
                lineCap: 'round',
                dashArray: isFallback ? '10, 10' : null
            };

            const bikeLine = L.polyline(option.routes.bikeToDestination.geometry, bikeStyle).addTo(map);

            const bikeLabel = option.bikeType === 'electric' ? '⚡ Bici eléctrica' : '🚴 Bici normal';
            bikeLine.bindPopup(isFallback ? `${bikeLabel} (ruta estimada)` : bikeLabel);

            window.currentRoutes.push(bikeLine);

            // Marcador estación bici
            const bikeStationPos = option.routes.bikeToDestination.geometry[0];
            const bikeIcon = option.bikeType === 'electric' ? '⚡' : '🚴';
            const bikeMarker = createRouteMarker(bikeStationPos, bikeIcon, bikeColor, 'Estación BiciCoruña');
            bikeMarker.addTo(map);
            window.currentRoutes.push(bikeMarker);

            // Marcador destino
            const destPos = option.routes.bikeToDestination.geometry[option.routes.bikeToDestination.geometry.length - 1];
            const destMarker = createRouteMarker(destPos, '🎯', '#10b981', 'Destino');
            destMarker.addTo(map);
            window.currentRoutes.push(destMarker);
        }
    }

    // Centrar mapa en las rutas
    if (window.currentRoutes.length > 0) {
        const routeLayers = window.currentRoutes.filter(layer => layer instanceof L.Polyline);
        if (routeLayers.length > 0) {
            const group = new L.featureGroup(routeLayers);
            map.fitBounds(group.getBounds(), {padding: [80, 80], maxZoom: 15});
        }
    }

    console.log('✅ Route drawn with', window.currentRoutes.length, 'layers');
}

/**
 * Helper: Crear marcador de ruta estilizado
 */
function createRouteMarker(position, emoji, color, label) {
    return L.marker(position, {
        icon: L.divIcon({
            className: 'route-marker-custom',
            html: `
                <div style="
                    background: ${color};
                    color: white;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    border: 3px solid white;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                    transition: transform 0.2s;
                    cursor: pointer;
                ">
                    ${emoji}
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        })
    }).bindPopup(label);
}

/**
 * Cerrar panel multimodal
 */
function closeMultimodalPanel() {
    const panel = document.getElementById('multimodalPanel');
    panel.classList.remove('active');

    // Limpiar rutas del mapa
    if (window.currentRoutes) {
        window.currentRoutes.forEach(layer => {
            try {
                map.removeLayer(layer);
            } catch (e) {
                // Ignorar errores
            }
        });
        window.currentRoutes = [];
    }

    // Limpiar datos
    window.currentMultimodalOptions = null;
}

console.log('✅ Multimodal module v2.0 loaded');
