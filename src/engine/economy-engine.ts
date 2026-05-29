import { PrismaClient, Soul } from '@prisma/client';
import logger from '../lib/logger.js';
import { SoulAction } from '../types/soul.js';
import { terraformingEngine } from './terraforming-engine.js';

export class EconomyEngine {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async processProduction(soul: Soul, action: SoulAction): Promise<void> {
        if (!action.output) {
            return;
        }

        const { resourceType, amount } = action.output;

        await this.prisma.soulResource.upsert({
            where: {
                soulId_resourceType: {
                    soulId: soul.id,
                    resourceType,
                },
            },
            update: {
                amount: { increment: amount },
            },
            create: {
                soulId: soul.id,
                resourceType,
                amount,
            },
        });
    }

    async updatePlanetStats(souls: Soul[]): Promise<void> {
        let stats = await this.prisma.planetStats.findFirst();

        if (!stats) {
            stats = await this.prisma.planetStats.create({
                data: {
                    oxygen: 0,
                    climate: 5,
                    water: 0,
                    biomass: 0,
                    tir: 5,
                    stage: 1,
                    population: souls.length,
                    dayCount: 1,
                },
            });
        }

        const facilities = await this.prisma.facility.findMany();
        const facilityData = facilities.map(f => ({ type: f.type, level: f.level }));

        await terraformingEngine.calculate(souls.length, facilityData);

        await this.prisma.planetStats.update({
            where: { id: stats.id },
            data: {
                population: souls.length,
            },
        });
    }
}