import { PrismaClient } from '@prisma/client';
import logger from '../lib/logger.js';
import { timeEngineInstance } from '../web/server.js';
import { ContentEngine, EngineEvent } from './content-engine.js';
import { io } from '../web/server.js';

export type WeatherType = 'clear' | 'sandstorm' | 'flare' | 'acid_rain' | 'extreme_cold' | 'rain';

export interface WeatherEffects {
    outdoorEfficiency: number;
    indoorEfficiency: number;
    equipmentDamage: number;
    energyModifier: number;
}

const WEATHER_EFFECTS: Record<WeatherType, WeatherEffects> = {
    clear: { outdoorEfficiency: 1.0, indoorEfficiency: 1.0, equipmentDamage: 0, energyModifier: 1.0 },
    sandstorm: { outdoorEfficiency: 0.4, indoorEfficiency: 0.8, equipmentDamage: 0.05, energyModifier: 0.2 },
    flare: { outdoorEfficiency: 0.7, indoorEfficiency: 0.9, equipmentDamage: 0, energyModifier: 1.5 },
    acid_rain: { outdoorEfficiency: 0.3, indoorEfficiency: 0.7, equipmentDamage: 0.08, energyModifier: 0.5 },
    extreme_cold: { outdoorEfficiency: 0.5, indoorEfficiency: 0.85, equipmentDamage: 0.03, energyModifier: 1.5 },
    rain: { outdoorEfficiency: 0.8, indoorEfficiency: 0.95, equipmentDamage: 0.01, energyModifier: 0.3 },
};

const WEATHER_DURATIONS: Record<WeatherType, { min: number; max: number }> = {
    clear: { min: 3, max: 10 },
    sandstorm: { min: 1, max: 20 },
    flare: { min: 1, max: 10 },
    acid_rain: { min: 1, max: 5 },
    extreme_cold: { min: 3, max: 15 },
    rain: { min: 1, max: 5 },
};

export class WeatherEngine {
    private prisma: PrismaClient;
    private contentEngine: ContentEngine;
    private currentWeather: WeatherType = 'clear';
    private remainingDuration: number = 0;
    private isInitialized: boolean = false;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
        this.contentEngine = new ContentEngine(prisma);
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        const stats = await this.prisma.planetStats.findFirst();
        if (stats) {
            this.currentWeather = 'clear';
            this.remainingDuration = this.randomDuration('clear');
            logger.info(`[Weather] Initialized with ${this.currentWeather}, lasting ${this.remainingDuration} hours`);
        }
        
        this.isInitialized = true;
    }

    async tick(): Promise<void> {
        await this.initialize();
        
        this.remainingDuration--;
        
        if (this.remainingDuration <= 0) {
            await this.transitionWeather();
        }

        this.broadcastWeather();
    }

    private async transitionWeather(): Promise<void> {
        const previousWeather = this.currentWeather;
        const terraformLevel = await this.getTerraformingLevel();
        
        const badWeatherChance = Math.max(0.1, 0.7 - (terraformLevel * 0.04));
        const isBadWeather = Math.random() < badWeatherChance;
        
        const weatherOptions: WeatherType[] = isBadWeather
            ? ['sandstorm', 'flare', 'acid_rain', 'extreme_cold']
            : ['clear', 'rain'];
        
        this.currentWeather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
        this.remainingDuration = this.randomDuration(this.currentWeather);

        logger.info(`[Weather] ${previousWeather} → ${this.currentWeather}, lasting ${this.remainingDuration} hours`);

        const event = this.createWeatherEvent(previousWeather, this.currentWeather);
        await this.contentEngine.receive(event);
    }

    private createWeatherEvent(from: WeatherType, to: WeatherType): EngineEvent {
        const eventType = to === 'clear' ? 'clear' : 
                         to === 'rain' ? 'rain' :
                         to === 'sandstorm' ? 'sandstorm' :
                         to === 'flare' ? 'flare' :
                         to === 'acid_rain' ? 'acid_rain' :
                         'extreme_cold';

        return {
            source: 'weather',
            type: eventType,
            timestamp: new Date(),
            urgency: to === 'clear' || to === 'rain' ? 'low' : 'medium',
            data: {
                previousWeather: from,
                currentWeather: to,
                duration: this.remainingDuration,
                effects: WEATHER_EFFECTS[to],
            },
        };
    }

    private randomDuration(weather: WeatherType): number {
        const { min, max } = WEATHER_DURATIONS[weather];
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    private async getTerraformingLevel(): Promise<number> {
        const stats = await this.prisma.planetStats.findFirst();
        if (!stats) return 1;
        
        const oxygen = (stats as any).oxygen || 0;
        const climate = (stats as any).climate || 5;
        const water = (stats as any).water || 0;
        const biomass = (stats as any).biomass || 0;
        
        const tir = oxygen * 0.3 + climate * 0.25 + water * 0.25 + biomass * 0.2;
        
        if (tir < 100) return 1;
        if (tir < 600) return 2;
        if (tir < 3600) return 3;
        if (tir < 21600) return 4;
        return Math.floor(Math.log(tir) / Math.log(6)) + 1;
    }

    private broadcastWeather(): void {
        io.emit('weather_update', {
            type: this.currentWeather,
            remainingHours: this.remainingDuration,
            effects: WEATHER_EFFECTS[this.currentWeather],
        });
    }

    getCurrentWeather(): WeatherType {
        return this.currentWeather;
    }

    getWeatherEffects(): WeatherEffects {
        return WEATHER_EFFECTS[this.currentWeather];
    }

    getRemainingDuration(): number {
        return this.remainingDuration;
    }

    applyEffectsToSoul(outdoor: boolean): number {
        const effects = WEATHER_EFFECTS[this.currentWeather];
        return outdoor ? effects.outdoorEfficiency : effects.indoorEfficiency;
    }

    getEquipmentDamage(): number {
        return WEATHER_EFFECTS[this.currentWeather].equipmentDamage;
    }

    getEnergyModifier(): number {
        return WEATHER_EFFECTS[this.currentWeather].energyModifier;
    }
}

export const weatherEngine = new WeatherEngine(new PrismaClient());