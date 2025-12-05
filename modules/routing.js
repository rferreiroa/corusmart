/* =====================================================
   ROUTING ENGINE - OpenRouteService Integration
   BiciCoruña Premium v2.2 - FIX: Manejo correcto respuesta ORS
===================================================== */

const RoutingEngine = {
    config: {
        apiKey: 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjJlNDhmM2ExNDRiMjQ0ZDdhYjE1YWM4MjkwNjRmMTc0IiwiaCI6Im11cm11cjY0In0=',
        baseUrl: 'https://api.openrouteservice.org/v2/directions',
        timeout: 15000,
        maxRetries: 2
    },

    async getWalkingRoute(start, end) {
        return await this.fetchRoute('foot-walking', start, end);
    },

    async getCyclingRoute(start, end, isElectric = false) {
        const route = await this.fetchRoute('cycling-regular', start, end);
        if (isElectric && route) {
            route.duration = route.duration * 0.75;
            route.isElectric = true;
        }
        return route;
    },

    async fetchRoute(profile, start, end, retries = 0) {
        try {
            const coordinates = [
                [start.lon, start.lat],
                [end.lon, end.lat]
            ];
            
            const url = `${this.config.baseUrl}/${profile}`;
            
            console.log(`🛣️ Fetching ${profile} route...`);
            console.log('Coordinates:', coordinates);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json, application/geo+json',
                    'Content-Type': 'application/json',
                    'Authorization': this.config.apiKey
                },
                body: JSON.stringify({
                    coordinates: coordinates,
                    format: 'json',
                    instructions: false,
                    geometry: true,
                    elevation: false
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('ORS Error:', response.status, errorText);
                throw new Error(`ORS API error: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('✅ ORS Response received');
            console.log('Response structure:', Object.keys(data));
            
            // ===== EXTRAER DATOS SEGÚN FORMATO =====
            let geometry, distance, duration;
            
            // OPCIÓN 1: Formato GeoJSON (features array)
            if (data.features && Array.isArray(data.features) && data.features.length > 0) {
                console.log('📦 Format: GeoJSON (features)');
                const feature = data.features[0];
                
                // Geometría
                if (feature.geometry && feature.geometry.coordinates) {
                    geometry = feature.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                }
                
                // Métricas
                if (feature.properties && feature.properties.summary) {
                    distance = feature.properties.summary.distance;
                    duration = feature.properties.summary.duration;
                } else if (feature.properties) {
                    distance = feature.properties.distance;
                    duration = feature.properties.duration;
                }
            }
            // OPCIÓN 2: Formato routes array (antiguo)
            else if (data.routes && Array.isArray(data.routes) && data.routes.length > 0) {
                console.log('📦 Format: Routes array');
                const route = data.routes[0];
                
                // Geometría (puede estar como string encoded o como objeto)
                if (route.geometry) {
                    if (typeof route.geometry === 'string') {
                        console.log('Decoding polyline...');
                        geometry = this.decodePolyline(route.geometry);
                    } else if (route.geometry.coordinates) {
                        geometry = route.geometry.coordinates.map(c => [c[1], c[0]]);
                    }
                }
                
                // Métricas (pueden estar en summary o directamente en route)
                if (route.summary) {
                    distance = route.summary.distance;
                    duration = route.summary.duration;
                } else {
                    distance = route.distance;
                    duration = route.duration;
                }
            }
            // OPCIÓN 3: Formato directo (sin features ni routes)
            else if (data.geometry && data.summary) {
                console.log('📦 Format: Direct object');
                
                if (typeof data.geometry === 'string') {
                    geometry = this.decodePolyline(data.geometry);
                } else if (data.geometry.coordinates) {
                    geometry = data.geometry.coordinates.map(c => [c[1], c[0]]);
                }
                
                distance = data.summary.distance;
                duration = data.summary.duration;
            }
            
            // ===== VALIDAR QUE TENEMOS DATOS =====
            if (!geometry || !distance || !duration) {
                console.error('❌ Missing required data in response');
                console.log('Geometry:', !!geometry);
                console.log('Distance:', distance);
                console.log('Duration:', duration);
                console.log('Full response:', JSON.stringify(data, null, 2));
                throw new Error('Invalid response format from ORS');
            }
            
            console.log(`✅ Route decoded: ${geometry.length} points, ${(distance/1000).toFixed(2)}km, ${Math.round(duration/60)}min`);
            
            return {
                profile: profile,
                distance: distance,
                duration: duration,
                geometry: geometry,
                bbox: data.bbox,
                raw: data
            };
            
        } catch (error) {
            console.error(`❌ Error fetching route (${profile}):`, error.message);
            
            if (retries < this.config.maxRetries && error.name !== 'AbortError') {
                console.log(`🔄 Retry ${retries + 1}/${this.config.maxRetries}...`);
                await this.delay(1500 * (retries + 1));
                return this.fetchRoute(profile, start, end, retries + 1);
            }
            
            console.warn('⚠️ Using fallback route');
            return this.getFallbackRoute(start, end, profile);
        }
    },

    decodePolyline(encoded) {
        const coordinates = [];
        let index = 0, lat = 0, lng = 0;

        while (index < encoded.length) {
            let b, shift = 0, result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lat += dlat;

            shift = 0;
            result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lng += dlng;

            coordinates.push([lat / 1e5, lng / 1e5]);
        }

        return coordinates;
    },

    getFallbackRoute(start, end, profile) {
        console.warn('⚠️ Generating fallback route with interpolation...');
        
        const distance = this.haversineDistance(start.lat, start.lon, end.lat, end.lon);
        
        const speeds = {
            'foot-walking': 5,
            'cycling-regular': 15,
            'cycling-electric': 20
        };
        const speed = speeds[profile] || 10;
        const duration = (distance / 1000 / speed) * 3600;
        
        // Generar más puntos para que la línea se vea más suave
        const numPoints = Math.max(20, Math.floor(distance / 50));
        const geometry = [];
        
        for (let i = 0; i <= numPoints; i++) {
            const ratio = i / numPoints;
            const lat = start.lat + (end.lat - start.lat) * ratio;
            const lon = start.lon + (end.lon - start.lon) * ratio;
            geometry.push([lat, lon]);
        }
        
        console.log(`📍 Fallback: ${(distance/1000).toFixed(2)}km, ${Math.round(duration/60)}min, ${geometry.length} points`);
        
        return {
            profile: profile,
            distance: distance,
            duration: duration,
            geometry: geometry,
            isFallback: true,
            warning: 'Ruta estimada (API no disponible)'
        };
    },

    haversineDistance(lat1, lon1, lat2, lon2) {
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
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    async calculateMultimodalOptions(parking, destination, allStations, preferences) {
        console.log('🧮 Calculating multimodal options...');
        
        try {
            // OPCIÓN A: Solo caminar
            const routeWalk = await this.getWalkingRoute(parking.location, destination);
            
            const optionA = {
                type: 'walk',
                name: 'Solo Caminar',
                totalTime: routeWalk.duration / 60,
                totalCost: parking.price_per_hour * 3,
                totalDistance: routeWalk.distance / 1000,
                co2Saved: 0,
                route: routeWalk,
                steps: [
                    `Aparcar en ${parking.name}`,
                    `Caminar ${(routeWalk.distance / 1000).toFixed(2)} km (${Math.round(routeWalk.duration / 60)} min)`
                ]
            };
            
            // OPCIÓN B: Bici normal
            const nearestNormal = this.findNearestStation(parking.location, allStations, 'normal');
            let optionB = null;
            
            if (nearestNormal) {
                const routeWalkToBike = await this.getWalkingRoute(
                    parking.location,
                    {lat: nearestNormal.lat, lon: nearestNormal.lon}
                );
                
                const routeBikeToDestination = await this.getCyclingRoute(
                    {lat: nearestNormal.lat, lon: nearestNormal.lon},
                    destination,
                    false
                );
                
                optionB = {
                    type: 'bike',
                    bikeType: 'normal',
                    name: 'Parking + Bici Normal',
                    totalTime: 5 + (routeWalkToBike.duration / 60) + 2 + (routeBikeToDestination.duration / 60),
                    totalCost: (parking.price_per_hour * 3) + 0.50,
                    totalDistance: (routeWalkToBike.distance + routeBikeToDestination.distance) / 1000,
                    co2Saved: 180,
                    bikeStation: nearestNormal,
                    routes: {
                        walkToBike: routeWalkToBike,
                        bikeToDestination: routeBikeToDestination
                    },
                    steps: [
                        `Aparcar en ${parking.name}`,
                        `Caminar a ${nearestNormal.name} (${Math.round(routeWalkToBike.duration / 60)} min)`,
                        `Coger bici (${nearestNormal.num_bikes_available - nearestNormal.num_ebikes_available} disponibles)`,
                        `Pedalear al destino (${Math.round(routeBikeToDestination.duration / 60)} min)`
                    ]
                };
            }
            
            // OPCIÓN C: Bici eléctrica
            const nearestElectric = this.findNearestStation(parking.location, allStations, 'electric');
            let optionC = null;
            
            if (nearestElectric) {
                const routeWalkToEbike = await this.getWalkingRoute(
                    parking.location,
                    {lat: nearestElectric.lat, lon: nearestElectric.lon}
                );
                
                const routeEbikeToDestination = await this.getCyclingRoute(
                    {lat: nearestElectric.lat, lon: nearestElectric.lon},
                    destination,
                    true
                );
                
                optionC = {
                    type: 'bike',
                    bikeType: 'electric',
                    name: 'Parking + Bici Eléctrica ⚡',
                    totalTime: 5 + (routeWalkToEbike.duration / 60) + 2 + (routeEbikeToDestination.duration / 60),
                    totalCost: (parking.price_per_hour * 3) + 0.50,
                    totalDistance: (routeWalkToEbike.distance + routeEbikeToDestination.distance) / 1000,
                    co2Saved: 200,
                    bikeStation: nearestElectric,
                    routes: {
                        walkToBike: routeWalkToEbike,
                        bikeToDestination: routeEbikeToDestination
                    },
                    steps: [
                        `Aparcar en ${parking.name}`,
                        `Caminar a ${nearestElectric.name} (${Math.round(routeWalkToEbike.duration / 60)} min)`,
                        `Coger bici eléctrica ⚡ (${nearestElectric.num_ebikes_available} disponibles)`,
                        `Pedalear al destino (${Math.round(routeEbikeToDestination.duration / 60)} min)`
                    ]
                };
            }
            
            const options = [optionA, optionB, optionC].filter(opt => opt !== null);
            
            return {
                parking: parking,
                destination: destination,
                options: options,
                calculatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error in calculateMultimodalOptions:', error);
            throw error;
        }
    },

    findNearestStation(location, allStations, bikeType = 'any') {
        let nearest = null;
        let minDistance = Infinity;
        
        allStations.forEach(station => {
            if (!station.is_renting) return;
            
            let hasBikes = false;
            if (bikeType === 'electric') {
                hasBikes = station.num_ebikes_available > 0;
            } else if (bikeType === 'normal') {
                hasBikes = (station.num_bikes_available - station.num_ebikes_available) > 0;
            } else {
                hasBikes = station.num_bikes_available > 0;
            }
            
            if (!hasBikes) return;
            
            const distance = this.haversineDistance(
                location.lat, location.lon,
                station.lat, station.lon
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                nearest = {
                    ...station,
                    distanceFromParking: distance
                };
            }
        });
        
        return nearest;
    }
};

if (typeof window !== 'undefined') {
    window.RoutingEngine = RoutingEngine;
}
