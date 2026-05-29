import { PrismaClient, Soul } from '@prisma/client';
import logger from '../lib/logger.js';

export type RelationType = 'stranger' | 'colleague' | 'friend' | 'rival' | 'family' | 'mentor';
export type InteractionType = 'conversation' | 'cooperation' | 'conflict' | 'gift' | 'betrayal' | 'gossip' | 'trade';

export interface SocialInteraction {
    id: number;
    soulAId: number;
    soulBId: number;
    type: InteractionType;
    trustChange: number;
    intimacyChange: number;
    timestamp: Date;
}

const INTERACTION_EFFECTS: Record<InteractionType, { trust: number; intimacy: number }> = {
    conversation: { trust: 0.025, intimacy: 0.02 },
    cooperation: { trust: 0.05, intimacy: 0.03 },
    conflict: { trust: -0.05, intimacy: -0.02 },
    gift: { trust: 0.08, intimacy: 0.05 },
    betrayal: { trust: -0.15, intimacy: -0.10 },
    gossip: { trust: 0.01, intimacy: 0.01 },
    trade: { trust: 0.03, intimacy: 0.02 },
};

export class SocialEngine {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async processSocialInteraction(
        soulAId: number,
        soulBId: number,
        type: InteractionType
    ): Promise<void> {
        const effects = INTERACTION_EFFECTS[type];
        
        await this.updateRelation(soulAId, soulBId, effects.trust, effects.intimacy);
        
        await this.prisma.socialInteraction.create({
            data: {
                soulAId,
                soulBId,
                type,
                effect: JSON.stringify(effects),
            },
        });

        logger.info(`[Social] Interaction: ${soulAId} <-> ${soulBId} (${type})`);
    }

    async updateRelation(
        soulAId: number,
        soulBId: number,
        trustDelta: number,
        intimacyDelta: number
    ): Promise<void> {
        const existing = await this.prisma.socialGraph.findUnique({
            where: {
                soulAId_soulBId: { soulAId, soulBId },
            },
        });

        if (existing) {
            const newTrust = Math.max(0, Math.min(1, existing.trust + trustDelta));
            const newIntimacy = Math.max(0, Math.min(1, existing.intimacy + intimacyDelta));
            const newTag = this.calculateTag(newTrust, newIntimacy);

            await this.prisma.socialGraph.update({
                where: { id: existing.id },
                data: {
                    trust: newTrust,
                    intimacy: newIntimacy,
                    familiarity: Math.min(1, existing.familiarity + 0.01),
                    tag: newTag,
                    interactionCount: existing.interactionCount + 1,
                },
            });
        } else {
            const trust = 0.5 + trustDelta;
            const intimacy = Math.max(0, intimacyDelta);
            const tag = this.calculateTag(trust, intimacy);

            await this.prisma.socialGraph.create({
                data: {
                    soulAId,
                    soulBId,
                    trust,
                    intimacy,
                    familiarity: 0.1,
                    tag,
                    interactionCount: 1,
                },
            });
        }
    }

    private calculateTag(trust: number, intimacy: number): RelationType {
        if (trust >= 0.7 && intimacy >= 0.5) return 'friend';
        if (trust <= 0.3 && intimacy < 0.2) return 'rival';
        if (trust >= 0.5 && intimacy >= 0.3) return 'colleague';
        if (intimacy >= 0.8) return 'family';
        return 'stranger';
    }

    async getSoulRelations(soulId: number): Promise<{
        friends: { soulId: number; name: string; trust: number; intimacy: number }[];
        rivals: { soulId: number; name: string; trust: number }[];
        colleagues: { soulId: number; name: string; trust: number }[];
    }> {
        const relations = await this.prisma.socialGraph.findMany({
            where: {
                OR: [{ soulAId: soulId }, { soulBId: soulId }],
            },
        });

        const friends: { soulId: number; name: string; trust: number; intimacy: number }[] = [];
        const rivals: { soulId: number; name: string; trust: number }[] = [];
        const colleagues: { soulId: number; name: string; trust: number }[] = [];

        for (const rel of relations) {
            const otherId = rel.soulAId === soulId ? rel.soulBId : rel.soulAId;
            const otherSoul = await this.prisma.soul.findUnique({ where: { id: otherId } });

            if (!otherSoul) continue;

            const entry = { soulId: otherId, name: otherSoul.name, trust: rel.trust };

            if (rel.tag === 'friend') {
                friends.push({ ...entry, intimacy: rel.intimacy });
            } else if (rel.tag === 'rival') {
                rivals.push(entry);
            } else {
                colleagues.push(entry);
            }
        }

        return { friends, rivals, colleagues };
    }

    async processSocialTick(souls: Soul[]): Promise<void> {
        if (souls.length < 2) return;

        if (Math.random() < 0.1) {
            const soulA = souls[Math.floor(Math.random() * souls.length)];
            const soulB = souls[Math.floor(Math.random() * souls.length)];

            if (soulA.id !== soulB.id) {
                const interactionTypes: InteractionType[] = ['conversation', 'cooperation', 'gossip'];
                const type = interactionTypes[Math.floor(Math.random() * interactionTypes.length)];

                await this.processSocialInteraction(soulA.id, soulB.id, type);
            }
        }
    }

    async spreadInformation(
        originSoulId: number,
        content: string,
        propagationProb: number = 0.3
    ): Promise<void> {
        const originRelations = await this.prisma.socialGraph.findMany({
            where: { OR: [{ soulAId: originSoulId }, { soulBId: originSoulId }] },
        });

        for (const rel of originRelations) {
            if (Math.random() < propagationProb) {
                const recipientId = rel.soulAId === originSoulId ? rel.soulBId : rel.soulAId;
                logger.info(`[Social] Information spread to ${recipientId}: "${content}"`);
            }
        }
    }

    async detectCommunities(): Promise<number[][]> {
        const relations = await this.prisma.socialGraph.findMany({
            where: { tag: { in: ['friend', 'colleague'] } },
        });

        const graph = new Map<number, Set<number>>();

        for (const rel of relations) {
            if (!graph.has(rel.soulAId)) graph.set(rel.soulAId, new Set());
            if (!graph.has(rel.soulBId)) graph.set(rel.soulBId, new Set());
            graph.get(rel.soulAId)!.add(rel.soulBId);
            graph.get(rel.soulBId)!.add(rel.soulAId);
        }

        const visited = new Set<number>();
        const communities: number[][] = [];

        for (const [node] of graph) {
            if (visited.has(node)) continue;

            const community: number[] = [];
            const queue = [node];

            while (queue.length > 0) {
                const current = queue.shift()!;
                if (visited.has(current)) continue;

                visited.add(current);
                community.push(current);

                const neighbors = graph.get(current) || new Set();
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        queue.push(neighbor);
                    }
                }
            }

            if (community.length > 0) {
                communities.push(community);
            }
        }

        return communities;
    }
}

export const socialEngine = new SocialEngine(new PrismaClient());