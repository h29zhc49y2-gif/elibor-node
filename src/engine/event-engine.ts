import { PrismaClient, Soul } from '@prisma/client';
import logger from '../lib/logger.js';

export class EventEngine {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async processRandomEvents(souls: Soul[]): Promise<void> {
        if (souls.length === 0) return;

        const random = Math.random();
        if (random < 0.1) {
            const soul = souls[Math.floor(Math.random() * souls.length)];
            logger.info(`[Event] Random event for soul ${soul.name}`);
        }
    }

    async processSocialEvents(souls: Soul[]): Promise<void> {
        if (souls.length < 2) return;

        const random = Math.random();
        if (random < 0.05) {
            const soulA = souls[Math.floor(Math.random() * souls.length)];
            const soulB = souls[Math.floor(Math.random() * souls.length)];
            if (soulA.id !== soulB.id) {
                await this.createSocialRelationship(soulA.id, soulB.id);
                logger.info(`[Event] Social event: ${soulA.name} met ${soulB.name}`);
            }
        }
    }

    private async createSocialRelationship(soulAId: number, soulBId: number): Promise<void> {
        const existing = await this.prisma.relationship.findUnique({
            where: {
                soulIdA_soulIdB: { soulIdA: soulAId, soulIdB: soulBId }
            }
        });

        if (!existing) {
            await this.prisma.relationship.create({
                data: {
                    soulIdA: soulAId,
                    soulIdB: soulBId,
                    type: 'stranger',
                    value: 10,
                }
            });
        } else {
            await this.prisma.relationship.update({
                where: { id: existing.id },
                data: { value: { increment: 5 } }
            });
        }
    }

    async generateDailyReport(day: number): Promise<void> {
        const events = await this.prisma.event.findMany({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            }
        });

        const stats = await this.prisma.planetStats.findFirst();
        const soulCount = await this.prisma.soul.count({ where: { status: 'alive' } });

        const report = {
            day,
            timestamp: new Date(),
            headline: this.generateHeadline(events),
            planetStats: stats ? {
                oxygen: (stats as any).oxygen || 0,
                climate: (stats as any).climate || 5,
                water: (stats as any).water || 0,
                biomass: (stats as any).biomass || 0,
                tir: (stats as any).tir || 0,
                stage: (stats as any).stage || 1,
                population: soulCount,
            } : null,
            highlights: this.generateHighlights(events),
            totalEvents: events.length,
        };

        await this.prisma.dailyReport.upsert({
            where: { dayCount: day },
            update: { content: JSON.stringify(report) },
            create: {
                dayCount: day,
                content: JSON.stringify(report),
            },
        });

        logger.info(`[Event] Daily report generated for Day ${day}`);
    }

    private generateHeadline(events: any[]): string {
        if (events.length === 0) {
            return '聚栖星球平静的一天';
        }
        return `今日发生了${events.length}件重要事件`;
    }

    private generateHighlights(events: any[]): string[] {
        return events.slice(0, 3).map(e => e.content);
    }

    private generateRandomEvent(soul: Soul): {
        type: string;
        content: string;
    } {
        const eventTypes = [
            { type: 'discovery', content: `${soul.name}发现了一处有趣的地方` },
            { type: 'achievement', content: `${soul.name}完成了今天的任务` },
            { type: 'social', content: `${soul.name}和其他栖人愉快地交流` },
        ];

        return eventTypes[Math.floor(Math.random() * eventTypes.length)];
    }
}