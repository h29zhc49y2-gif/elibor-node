import { PrismaClient } from '@prisma/client';
import logger from '../lib/logger.js';
import { ContentEngine, EngineEvent } from './content-engine.js';

export type MeteorType = 'mineral' | 'ice' | 'energy' | 'rare' | 'life' | 'disaster';

export interface MeteorReward {
    type: MeteorType;
    amount: number;
    isPositive: boolean;
}

export interface MeteorCrater {
    id: number;
    type: Exclude<MeteorType, 'disaster'>;
    remainingDays: number;
    dailyOutput: number;
}

const METEOR_BASE_CHANCE = 0.1;

const METEOR_REWARDS: Record<MeteorType, { min: number; max: number; resource?: string }> = {
    mineral: { min: 30, max: 50, resource: 'mineral' },
    ice: { min: 20, max: 40, resource: 'water' },
    energy: { min: 100, max: 200, resource: 'energy' },
    rare: { min: 15, max: 30, resource: 'rare_mineral' },
    life: { min: 50, max: 100, resource: 'biomass' },
    disaster: { min: 5, max: 50, resource: undefined },
};

export class MeteorEngine {
    private prisma: PrismaClient;
    private contentEngine: ContentEngine;
    private activeCraters: Map<number, MeteorCrater> = new Map();
    private craterIdCounter: number = 1;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
        this.contentEngine = new ContentEngine(prisma);
    }

    async tick(): Promise<void> {
        if (Math.random() < this.getMeteorChance()) {
            await this.triggerMeteor();
        }

        this.decayCraters();
    }

    private getMeteorChance(): number {
        return METEOR_BASE_CHANCE;
    }

    private async triggerMeteor(): Promise<void> {
        const meteorType = this.rollMeteorType();
        const reward = this.calculateReward(meteorType);

        if (reward.isPositive) {
            await this.grantReward(reward);
        } else {
            await this.causeDisaster(reward.amount);
        }

        const event = this.createMeteorEvent(meteorType, reward);
        await this.contentEngine.receive(event);

        logger.info(`[Meteor] ${meteorType} meteor hit, reward: ${reward.amount}`);
    }

    private rollMeteorType(): MeteorType {
        const rand = Math.random();
        const disasterChance = 0.3;

        if (rand < disasterChance) {
            return 'disaster';
        }

        const types: MeteorType[] = ['mineral', 'ice', 'energy', 'rare', 'life'];
        return types[Math.floor(Math.random() * types.length)];
    }

    private calculateReward(type: MeteorType): MeteorReward {
        const config = METEOR_REWARDS[type];
        const baseAmount = Math.floor(Math.random() * (config.max - config.min + 1)) + config.min;

        if (type === 'disaster') {
            const damagePercent = baseAmount / 100;
            return {
                type,
                amount: damagePercent,
                isPositive: false,
            };
        }

        return {
            type,
            amount: baseAmount,
            isPositive: true,
        };
    }

    private async grantReward(reward: MeteorReward): Promise<void> {
        const resource = METEOR_REWARDS[reward.type].resource;
        if (!resource) return;

        await this.prisma.planetStats.upsert({
            where: { id: 1 },
            create: { id: 1 },
            update: {
                energy: reward.type === 'energy' ? { increment: reward.amount } : undefined,
            } as any,
        });

        this.createCrater(reward.type as Exclude<MeteorType, 'disaster'>, reward.amount);
    }

    private createCrater(type: Exclude<MeteorType, 'disaster'>, amount: number): void {
        const crater: MeteorCrater = {
            id: this.craterIdCounter++,
            type,
            remainingDays: type === 'rare' ? 5 : 3,
            dailyOutput: Math.floor(amount * 0.4),
        };
        this.activeCraters.set(crater.id, crater);
        logger.info(`[Meteor] Crater ${crater.id} created, ${crater.remainingDays} days`);
    }

    private decayCraters(): void {
        const toRemove: number[] = [];

        this.activeCraters.forEach((crater, id) => {
            crater.remainingDays--;

            if (crater.remainingDays <= 0) {
                toRemove.push(id);
            }
        });

        toRemove.forEach(id => {
            this.activeCraters.delete(id);
            logger.info(`[Meteor] Crater ${id} expired`);
        });
    }

    private async causeDisaster(damagePercent: number): Promise<void> {
        logger.warn(`[Meteor] Disaster meteor! Damage: ${damagePercent * 100}%`);
    }

    private createMeteorEvent(type: MeteorType, reward: MeteorReward): EngineEvent {
        const eventType = type;
        const urgency = type === 'disaster' ? 'high' : 'medium';

        return {
            source: 'meteor',
            type: eventType,
            timestamp: new Date(),
            urgency,
            data: {
                meteorType: type,
                amount: reward.amount,
                isPositive: reward.isPositive,
                craterDays: type !== 'disaster' ? (type === 'rare' ? 5 : 3) : 0,
            },
        };
    }

    getActiveCraters(): MeteorCrater[] {
        return Array.from(this.activeCraters.values());
    }

    getCraterOutput(craterType: string): number {
        for (const crater of this.activeCraters.values()) {
            if (crater.type === craterType) {
                return crater.dailyOutput;
            }
        }
        return 0;
    }
}

export const meteorEngine = new MeteorEngine(new PrismaClient());