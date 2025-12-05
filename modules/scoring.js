/* =====================================================
   SCORING ENGINE - Sistema de Puntuación Inteligente
   BiciCoruña Premium v2.0
   ===================================================== */

/**
 * Motor de scoring para evaluar opciones multimodales
 * Pondera tiempo, coste, sostenibilidad y disponibilidad
 */
const ScoringEngine = {
    // Perfiles de preferencias de usuario
    profiles: {
        balanced: {
            name: 'Equilibrado',
            icon: '⚖️',
            weights: {
                time: 0.35,
                cost: 0.30,
                eco: 0.25,
                availability: 0.10
            }
        },
        fast: {
            name: 'Rápido',
            icon: '⚡',
            weights: {
                time: 0.60,
                cost: 0.15,
                eco: 0.15,
                availability: 0.10
            }
        },
        cheap: {
            name: 'Económico',
            icon: '💶',
            weights: {
                time: 0.15,
                cost: 0.60,
                eco: 0.15,
                availability: 0.10
            }
        },
        eco: {
            name: 'Ecológico',
            icon: '🌱',
            weights: {
                time: 0.20,
                cost: 0.15,
                eco: 0.55,
                availability: 0.10
            }
        }
    },

    // Perfil activo (por defecto: equilibrado)
    activeProfile: 'balanced',

    /**
     * Establecer perfil de usuario
     * @param {string} profileName - 'balanced', 'fast', 'cheap', 'eco'
     */
    setProfile(profileName) {
        if (this.profiles[profileName]) {
            this.activeProfile = profileName;
            console.log(`📊 Scoring profile set to: ${this.profiles[profileName].name}`);
        }
    },

    /**
     * Obtener pesos actuales
     */
    getWeights() {
        return this.profiles[this.activeProfile].weights;
    },

    /**
     * MÉTODO PRINCIPAL: Evaluar y puntuar todas las opciones
     * @param {Array} options - Array de opciones multimodales
     * @param {Object} context - Contexto adicional (clima, hora, etc)
     * @returns {Array} Opciones con scores calculados
     */
    scoreAllOptions(options, context = {}) {
        console.log('📊 Scoring options...');

        // Calcular valores de referencia para normalización
        const references = this._calculateReferences(options);

        // Puntuar cada opción
        const scoredOptions = options.map(option => {
            const scores = this.scoreOption(option, references, context);
            return {
                ...option,
                scores: scores,
                finalScore: scores.total,
                rank: 0 // Se asignará después
            };
        });

        // Ordenar por score (mayor a menor)
        scoredOptions.sort((a, b) => b.finalScore - a.finalScore);

        // Asignar ranking
        scoredOptions.forEach((opt, index) => {
            opt.rank = index + 1;
            opt.isRecommended = index === 0;
        });

        console.log('✅ Scoring completed:', scoredOptions.map(o => ({
            name: o.name,
            score: o.finalScore.toFixed(1),
            rank: o.rank
        })));

        return scoredOptions;
    },

    /**
     * Calcular score de una opción individual
     * @param {Object} option - Opción a evaluar
     * @param {Object} references - Valores de referencia para normalización
     * @param {Object} context - Contexto (clima, etc)
     * @returns {Object} Scores desglosados
     */
    scoreOption(option, references, context = {}) {
        const weights = this.getWeights();

        // 1️⃣ SCORE DE TIEMPO (0-100)
        // Menor tiempo = mayor score
        const timeScore = this._normalizeTime(option.totalTime, references.minTime, references.maxTime);

        // 2️⃣ SCORE DE COSTE (0-100)
        // Menor coste = mayor score
        const costScore = this._normalizeCost(option.totalCost, references.minCost, references.maxCost);

        // 3️⃣ SCORE DE SOSTENIBILIDAD (0-100)
        // Más CO2 ahorrado = mayor score
        const ecoScore = this._normalizeEco(option.co2Saved, references.maxCo2);

        // 4️⃣ SCORE DE DISPONIBILIDAD (0-100)
        // Mayor disponibilidad de bicis = mayor score
        const availabilityScore = this._normalizeAvailability(option);

        // 5️⃣ BONUS POR CONTEXTO
        let contextBonus = 0;

        // Si llueve, penalizar opciones de bici
        if (context.isRaining && option.type === 'bike') {
            contextBonus -= 15;
        }

        // Si hace mucho frío, penalizar bici normal más que eléctrica
        if (context.temperature && context.temperature < 5) {
            if (option.bikeType === 'normal') {
                contextBonus -= 10;
            } else if (option.bikeType === 'electric') {
                contextBonus -= 5;
            }
        }

        // Si parking casi lleno, dar bonus
        if (option.type !== 'walk' && context.parkingRisk === 'high') {
            contextBonus += 10;
        }

        // 6️⃣ CALCULAR SCORE FINAL
        const weightedScore =
            timeScore * weights.time +
            costScore * weights.cost +
            ecoScore * weights.eco +
            availabilityScore * weights.availability;

        const totalScore = Math.max(0, Math.min(100, weightedScore + contextBonus));

        return {
            time: Math.round(timeScore),
            cost: Math.round(costScore),
            eco: Math.round(ecoScore),
            availability: Math.round(availabilityScore),
            contextBonus: Math.round(contextBonus),
            total: Math.round(totalScore),
            breakdown: {
                timeContribution: timeScore * weights.time,
                costContribution: costScore * weights.cost,
                ecoContribution: ecoScore * weights.eco,
                availabilityContribution: availabilityScore * weights.availability
            }
        };
    },

    /**
     * Calcular valores de referencia para normalización
     * @private
     */
    _calculateReferences(options) {
        const times = options.map(o => o.totalTime);
        const costs = options.map(o => o.totalCost);
        const co2s = options.map(o => o.co2Saved || 0);

        return {
            minTime: Math.min(...times),
            maxTime: Math.max(...times),
            minCost: Math.min(...costs),
            maxCost: Math.max(...costs),
            maxCo2: Math.max(...co2s)
        };
    },

    /**
     * Normalizar score de tiempo (0-100)
     * Menor tiempo = score más alto
     * @private
     */
    _normalizeTime(time, minTime, maxTime) {
        if (maxTime === minTime) return 100;

        // Invertir: tiempo mínimo = 100, tiempo máximo = 0
        const normalized = 100 - ((time - minTime) / (maxTime - minTime)) * 100;

        // Aplicar curva logarítmica para penalizar más las diferencias grandes
        return Math.pow(normalized / 100, 0.8) * 100;
    },

    /**
     * Normalizar score de coste (0-100)
     * Menor coste = score más alto
     * @private
     */
    _normalizeCost(cost, minCost, maxCost) {
        if (maxCost === minCost) return 100;

        const normalized = 100 - ((cost - minCost) / (maxCost - minCost)) * 100;
        return normalized;
    },

    /**
     * Normalizar score de sostenibilidad (0-100)
     * Más CO2 ahorrado = score más alto
     * @private
     */
    _normalizeEco(co2Saved, maxCo2) {
        if (maxCo2 === 0) return 50; // Neutral si ninguna opción ahorra CO2

        // 200g de CO2 = 100 puntos (referencia)
        const baseScore = (co2Saved / 200) * 100;

        // Bonus si supera el 150% del máximo
        const normalized = Math.min(100, baseScore);

        return normalized;
    },

    /**
     * Normalizar score de disponibilidad (0-100)
     * Más bicis disponibles = score más alto
     * @private
     */
    _normalizeAvailability(option) {
        if (option.type === 'walk') {
            // Caminar siempre está disponible
            return 100;
        }

        if (!option.bikeStation) {
            return 0; // No hay estación disponible
        }

        const station = option.bikeStation;
        let bikesAvailable = 0;

        if (option.bikeType === 'electric') {
            bikesAvailable = station.num_ebikes_available || 0;
        } else if (option.bikeType === 'normal') {
            bikesAvailable = (station.num_bikes_available - station.num_ebikes_available) || 0;
        } else {
            bikesAvailable = station.num_bikes_available || 0;
        }

        // Escalado: 1 bici = 50 puntos, 5+ bicis = 100 puntos
        if (bikesAvailable >= 5) return 100;
        if (bikesAvailable >= 3) return 80;
        if (bikesAvailable >= 2) return 65;
        if (bikesAvailable >= 1) return 50;
        return 0;
    },

    /**
     * Generar explicación textual del score
     * @param {Object} scoredOption - Opción con scores
     * @returns {string} Explicación legible
     */
    getScoreExplanation(scoredOption) {
        const s = scoredOption.scores;
        const profile = this.profiles[this.activeProfile];

        let explanation = `Puntuación según perfil "${profile.name}" ${profile.icon}:\n\n`;

        explanation += `⏱️ Tiempo: ${s.time}/100 (peso ${(profile.weights.time * 100).toFixed(0)}%)\n`;
        explanation += `💶 Coste: ${s.cost}/100 (peso ${(profile.weights.cost * 100).toFixed(0)}%)\n`;
        explanation += `🌱 Ecología: ${s.eco}/100 (peso ${(profile.weights.eco * 100).toFixed(0)}%)\n`;
        explanation += `🚴 Disponibilidad: ${s.availability}/100 (peso ${(profile.weights.availability * 100).toFixed(0)}%)\n`;

        if (s.contextBonus !== 0) {
            explanation += `\n🎯 Ajuste contextual: ${s.contextBonus > 0 ? '+' : ''}${s.contextBonus} puntos\n`;
        }

        explanation += `\n━━━━━━━━━━━━━━━\n`;
        explanation += `📊 PUNTUACIÓN TOTAL: ${s.total}/100`;

        return explanation;
    },

    /**
     * Obtener badge visual según score
     * @param {number} score - Score total (0-100)
     * @returns {Object} {class, text, icon}
     */
    getScoreBadge(score) {
        if (score >= 80) {
            return {
                class: 'score-excellent',
                text: 'Excelente',
                icon: '🏆',
                color: '#10b981'
            };
        } else if (score >= 60) {
            return {
                class: 'score-good',
                text: 'Buena',
                icon: '✅',
                color: '#3b82f6'
            };
        } else if (score >= 40) {
            return {
                class: 'score-ok',
                text: 'Aceptable',
                icon: '👍',
                color: '#f59e0b'
            };
        } else {
            return {
                class: 'score-poor',
                text: 'Mejorable',
                icon: '⚠️',
                color: '#ef4444'
            };
        }
    }
};

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ScoringEngine = ScoringEngine;
}
