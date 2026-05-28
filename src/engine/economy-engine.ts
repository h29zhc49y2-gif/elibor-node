import { PrismaClient, Soul } from '@prisma/client';
import logger from '../lib/logger.js';
import { SoulAction } from '../types/soul.js';

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

        // 更新栖人资源
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

        // 更新星球指数
        await this.updatePlanetIndex(soul.profession, amount);
    }

    async updatePlanetStats(souls: Soul[]): Promise<void> {
        let stats = await this.prisma.planetStats.findFirst();

        if (!stats) {
            stats = await this.prisma.planetStats.create({
                data: {
                    industry: 10,
                    agriculture: 10,
                    housing: 10,
                    technology: 5,
                    energy: 10,
                    population: souls.length,
                    dayCount: 1,
                },
            });
        }

        // 更新人口
        await this.prisma.planetStats.update({
            where: { id: stats.id },
            data: {
                population: souls.length,
            },
        });
    }

    private async updatePlanetIndex(profession: string, amount: number): Promise<void> {
        let stats = await this.prisma.planetStats.findFirst();

        if (!stats) {
            return;
        }

        const updates: Record<string, any> = {};

        // 根据职业更新对应的指数
        switch (profession) {
            case 'miner':
                updates.industry = Math.min(100, stats.industry + amount * 0.1);
                updates.energy = Math.min(100, stats.energy + amount * 0.02);
                break;
            case 'farmer':
                updates.agriculture = Math.min(100, stats.agriculture + amount * 0.1);
                break;
            case 'engineer':
                updates.industry = Math.min(100, stats.industry + amount * 0.05);
                updates.energy = Math.min(100, stats.energy + amount * 0.05);
                break;
            case 'architect':
                updates.housing = Math.min(100, stats.housing + amount * 0.1);
                break;
            case 'scientist':
                updates.technology = Math.min(100, stats.technology + amount * 0.1);
                break;
            case 'healer':
                updates.housing = Math.min(100, stats.housing + amount * 0.1);
                break;
            case 'energy_engineer':
                updates.energy = Math.min(100, stats.energy + amount * 0.1);
                break;
            case 'teacher':
                updates.technology = Math.min(100, stats.technology + amount * 0.1);
                break;
        }

        if (Object.keys(updates).length > 0) {
            await this.prisma.planetStats.update({
                where: { id: stats.id },
                data: updates,
            });
        }
    }

    calculateProsperity(stats: {
        industry: number;
        agriculture: number;
        housing: number;
        technology: number;
        energy: number;
    }): number {
        return Math.round(
            stats.industry * 0.25 +
            stats.agriculture * 0.20 +
            stats.housing * 0.20 +
            stats.technology * 0.15 +
            stats.energy * 0.20
        );
    }
}
