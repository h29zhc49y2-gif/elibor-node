import { PrismaClient } from '@prisma/client';
import logger from '../lib/logger.js';
import { ContentEngine, EngineEvent } from './content-engine.js';

export interface TerraformingIndices {
    oxygen: number;
    climate: number;
    water: number;
    biomass: number;
    tir: number;
    stage: number;
    stageName: string;
}

const STAGE_THRESHOLDS = [
    0,      // Stage 1
    100,    // Stage 2
    600,    // Stage 3
    3600,   // Stage 4
    21600,  // Stage 5
    129600, // Stage 6
    777600, // Stage 7
    4665600, // Stage 8
];

const STAGE_NAMES = [
    '荒芜期',
    '萌芽期',
    '初期建设',
    '基础稳固',
    '稳步发展',
    '初步繁荣',
    '环境改善',
    '生态初现',
];

const STAGE_NAMES_EN = [
    'Barren Era',
    'Sprouting Era',
    'Early Construction',
    'Foundation Set',
    'Steady Development',
    'Early Prosperity',
    'Environment Improved',
    'Ecology Emerging',
];

export class TerraformingEngine {
    private prisma: PrismaClient;
    private contentEngine: ContentEngine;
    private lastStage: number = 1;
    private currentIndices: TerraformingIndices = {
        oxygen: 0,
        climate: 5,
        water: 0,
        biomass: 0,
        tir: 5,
        stage: 1,
        stageName: '荒芜期'
    };

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
        this.contentEngine = new ContentEngine(prisma);
    }

    getIndices(): TerraformingIndices {
        return this.currentIndices;
    }

    async calculate(soulCount: number, facilities: { type: string; level: number }[]): Promise<TerraformingIndices> {
        const stats = await this.prisma.planetStats.findFirst();
        
        const oxygen = this.calculateOxygen(soulCount, facilities);
        const climate = this.calculateClimate(soulCount, facilities);
        const water = this.calculateWater(soulCount, facilities);
        const biomass = this.calculateBiomass(soulCount, facilities);

        const tir = this.calculateTIR(oxygen, climate, water, biomass);
        const stage = this.calculateStage(tir);
        const stageNameInfo = this.getStageName(stage);

        this.currentIndices = { oxygen, climate, water, biomass, tir, stage, stageName: stageNameInfo.cn };

        await this.updateStats(oxygen, climate, water, biomass, tir, stage);

        if (stage > this.lastStage) {
            await this.onStageChange(stage);
            this.lastStage = stage;
        }

        return this.currentIndices;
    }

    private calculateOxygen(soulCount: number, facilities: { type: string; level: number }[]): number {
        let base = soulCount * 0.5;
        
        for (const f of facilities) {
            if (f.type === 'oxygen') {
                base += f.level * 15;
            }
        }
        
        return Math.min(100, base);
    }

    private calculateClimate(soulCount: number, facilities: { type: string; level: number }[]): number {
        let base = 5 + soulCount * 0.3;
        
        for (const f of facilities) {
            if (f.type === 'climate') {
                base += f.level * 20;
            }
        }
        
        return Math.min(100, base);
    }

    private calculateWater(soulCount: number, facilities: { type: string; level: number }[]): number {
        let base = soulCount * 0.2;
        
        for (const f of facilities) {
            if (f.type === 'water') {
                base += f.level * 12;
            }
        }
        
        return Math.min(100, base);
    }

    private calculateBiomass(soulCount: number, facilities: { type: string; level: number }[]): number {
        let base = soulCount * 0.1;
        
        for (const f of facilities) {
            if (f.type === 'biomass') {
                base += f.level * 20;
            }
        }
        
        return Math.min(100, base);
    }

    private calculateTIR(oxygen: number, climate: number, water: number, biomass: number): number {
        return Math.floor(
            oxygen * 0.30 +
            climate * 0.25 +
            water * 0.25 +
            biomass * 0.20
        );
    }

    private calculateStage(tir: number): number {
        for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
            if (tir >= STAGE_THRESHOLDS[i]) {
                return i + 1;
            }
        }
        return 1;
    }

    private async updateStats(
        oxygen: number,
        climate: number,
        water: number,
        biomass: number,
        tir: number,
        stage: number
    ): Promise<void> {
        await this.prisma.planetStats.upsert({
            where: { id: 1 },
            create: {
                id: 1,
                oxygen,
                climate,
                water,
                biomass,
                tir: tir,
                stage,
            },
            update: {
                oxygen,
                climate,
                water,
                biomass,
                tir,
                stage,
            },
        });
    }

    private async onStageChange(newStage: number): Promise<void> {
        logger.info(`[Terraforming] Stage changed to ${newStage}`);

        const event: EngineEvent = {
            source: 'stage',
            type: 'breakthrough',
            timestamp: new Date(),
            urgency: 'high',
            data: {
                stage: newStage,
                stageName: STAGE_NAMES[newStage - 1] || '新时代',
                stageNameEn: STAGE_NAMES_EN[newStage - 1] || 'New Era',
            },
        };

        await this.contentEngine.receive(event);
    }

    getStageName(stage: number): { cn: string; en: string } {
        return {
            cn: STAGE_NAMES[stage - 1] || '新时代',
            en: STAGE_NAMES_EN[stage - 1] || 'New Era',
        };
    }

    getStageInfo(stage: number): { threshold: number; next: number } {
        const currentThreshold = STAGE_THRESHOLDS[stage - 1] || 0;
        const nextThreshold = STAGE_THRESHOLDS[stage] || STAGE_THRESHOLDS[STAGE_THRESHOLDS.length - 1] * 6;
        return { threshold: currentThreshold, next: nextThreshold };
    }
}

export const terraformingEngine = new TerraformingEngine(new PrismaClient());