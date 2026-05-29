import { PrismaClient, Soul } from '@prisma/client';
import logger from '../lib/logger.js';

export class EventEngine {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async processRandomEvents(souls: Soul[]): Promise<void> {
        // 每次 tick 有 10% 概率触发随机事件
        if (Math.random() > 0.1) {
            return;
        }

        // 随机选择一个栖人
        if (souls.length === 0) {
            return;
        }

        const randomSoul = souls[Math.floor(Math.random() * souls.length)];

        // 生成随机事件
        const event = this.generateRandomEvent(randomSoul);

        // 记录事件
        await this.prisma.event.create({
            data: {
                soulId: randomSoul.id,
                type: event.type,
                content: event.content,
                metadata: JSON.stringify(event.metadata),
            },
        });

        // 应用事件效果
        if (event.effect) {
            await this.applyEventEffect(randomSoul.id, event.effect);
        }

        logger.info(`[Event] Random event for ${randomSoul.name}: ${event.content}`);
    }

    async processSocialEvents(souls: Soul[]): Promise<void> {
        // 每次 tick 有 5% 概率触发社交事件
        if (Math.random() > 0.05 || souls.length < 2) {
            return;
        }

        // 随机选择两个栖人
        const shuffled = [...souls].sort(() => Math.random() - 0.5);
        const soul1 = shuffled[0];
        const soul2 = shuffled[1];

        // 检查是否有现有关系
        let relationship = await this.prisma.relationship.findFirst({
            where: {
                OR: [
                    { soulIdA: soul1.id, soulIdB: soul2.id },
                    { soulIdA: soul2.id, soulIdB: soul1.id },
                ],
            },
        });

        if (!relationship) {
            // 创建新关系
            relationship = await this.prisma.relationship.create({
                data: {
                    soulIdA: soul1.id,
                    soulIdB: soul2.id,
                    type: 'stranger',
                    value: 0,
                },
            });
        }

        // 增加关系值
        const newValue = Math.min(100, relationship.value + Math.floor(Math.random() * 5) + 1);
        const newType = this.getRelationshipType(newValue);

        await this.prisma.relationship.update({
            where: { id: relationship.id },
            data: {
                value: newValue,
                type: newType,
            },
        });

        // 记录社交事件
        const eventContent = this.generateSocialEventContent(soul1.name, soul2.name, newType);

        await this.prisma.event.create({
            data: {
                soulId: soul1.id,
                type: 'social',
                content: eventContent,
                metadata: JSON.stringify({
                    partnerId: soul2.id,
                    partnerName: soul2.name,
                    relationshipType: newType,
                    relationshipValue: newValue,
                }),
            },
        });

        // 增加社交需求
        await this.prisma.soul.update({
            where: { id: soul1.id },
            data: { social: { increment: 5 } },
        });
        await this.prisma.soul.update({
            where: { id: soul2.id },
            data: { social: { increment: 5 } },
        });

        logger.info(`[Event] Social event: ${soul1.name} and ${soul2.name} - ${newType}`);
    }

    async generateDailyReport(day: number): Promise<void> {
        // 获取当天的所有事件
        const events = await this.prisma.event.findMany({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // 获取星球状态
        const stats = await this.prisma.planetStats.findFirst();

        // 获取活跃栖人数量
        const soulCount = await this.prisma.soul.count({
            where: { status: 'alive' },
        });

        // 生成播报内容
        const report = {
            day,
            timestamp: new Date(),
            headline: this.generateHeadline(events),
            planetStats: stats ? {
                oxygen: Math.round(stats.oxygen),
                climate: Math.round(stats.climate),
                water: Math.round(stats.water),
                biomass: Math.round(stats.biomass),
                tir: Math.round(stats.tir),
                stage: stats.stage,
                population: soulCount,
            } : null,
            highlights: this.generateHighlights(events),
            totalEvents: events.length,
        };

        // 保存播报
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

    private generateRandomEvent(soul: Soul): {
        type: string;
        content: string;
        metadata: any;
        effect?: Record<string, number>;
    } {
        const events = [
            {
                type: 'discovery',
                content: `${soul.name}发现了一块罕见的能量水晶！`,
                metadata: { item: 'energy_crystal' },
                effect: { emotion: 15 },
            },
            {
                type: 'weather',
                content: `今天天气晴朗，${soul.name}心情愉快。`,
                metadata: { weather: 'sunny' },
                effect: { emotion: 10 },
            },
            {
                type: 'weather',
                content: `暴风雨来袭，${soul.name}不得不躲进避难所。`,
                metadata: { weather: 'storm' },
                effect: { emotion: -10 },
            },
            {
                type: 'achievement',
                content: `${soul.name}完成了今天的任务，感到满足。`,
                metadata: { achievement: 'daily_task' },
                effect: { emotion: 5, learning: 5 },
            },
            {
                type: 'accident',
                content: `${soul.name}不小心摔倒了，受了点轻伤。`,
                metadata: { accident: 'fall' },
                effect: { emotion: -5, energy: -10 },
            },
            {
                type: 'discovery',
                content: `${soul.name}发现了一个隐藏的洞穴！`,
                metadata: { discovery: 'hidden_cave' },
                effect: { emotion: 20 },
            },
        ];

        return events[Math.floor(Math.random() * events.length)] as unknown as { type: string; content: string; metadata: any; effect?: Record<string, number> };
    }

    private async applyEventEffect(soulId: number, effect: Record<string, number>): Promise<void> {
        const updates: Record<string, any> = {};

        for (const [key, value] of Object.entries(effect)) {
            updates[key] = { increment: value };
        }

        await this.prisma.soul.update({
            where: { id: soulId },
            data: updates,
        });
    }

    private getRelationshipType(value: number): string {
        if (value <= 20) return 'stranger';
        if (value <= 40) return 'acquaintance';
        if (value <= 60) return 'friend';
        if (value <= 80) return 'close_friend';
        return 'best_friend';
    }

    private generateSocialEventContent(name1: string, name2: string, type: string): string {
        const templates: Record<string, string[]> = {
            stranger: [
                `${name1}和${name2}初次见面，互相打了招呼。`,
            ],
            acquaintance: [
                `${name1}和${name2}聊了一会儿天。`,
                `${name1}帮${name2}解决了一个小问题。`,
            ],
            friend: [
                `${name1}和${name2}一起度过了愉快的时光。`,
                `${name1}送给${name2}一份小礼物。`,
            ],
            close_friend: [
                `${name1}和${name2}分享了彼此的秘密。`,
                `${name1}和${name2}一起完成了一项任务。`,
            ],
            best_friend: [
                `${name1}和${name2}是亲密无间的好朋友。`,
                `${name1}和${name2}互相支持，共同成长。`,
            ],
        };

        const typeTemplates = templates[type] || templates.stranger;
        return typeTemplates[Math.floor(Math.random() * typeTemplates.length)];
    }

    private generateHeadline(events: any[]): string {
        if (events.length === 0) {
            return '今天是平静的一天';
        }

        const socialEvents = events.filter(e => e.type === 'social');
        const randomEvents = events.filter(e => e.type === 'discovery' || e.type === 'weather');

        if (socialEvents.length > 3) {
            return '今天是热闹的一天，栖人们进行了许多社交活动';
        }

        if (randomEvents.length > 0) {
            return randomEvents[0].content;
        }

        return `今天发生了${events.length}件事情`;
    }

    private generateHighlights(events: any[]): string[] {
        // 取前5个重要事件作为亮点
        return events
            .slice(0, 5)
            .map(e => e.content);
    }
}
