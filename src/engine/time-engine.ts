import { PrismaClient } from '@prisma/client';
import logger from '../lib/logger.js';

export interface PlanetTime {
    day: number;
    hour: number;
    minute: number;
    timestamp: Date;
}

export class TimeEngine {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async advance(): Promise<PlanetTime> {
        // 获取当前星球状态
        let stats = await this.prisma.planetStats.findFirst();

        if (!stats) {
            stats = await this.prisma.planetStats.create({
                data: {
                    industry: 10,
                    agriculture: 10,
                    housing: 10,
                    technology: 5,
                    energy: 10,
                    population: 0,
                    dayCount: 1,
                },
            });
        }

        // 计算当前星球时间
        // 每6分钟 = 星球1小时
        // 24小时 = 144分钟 = 星球1天
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const minutesSinceMidnight = Math.floor((now.getTime() - startOfDay.getTime()) / 60000);
        const planetHour = Math.floor(minutesSinceMidnight / 6) % 24;
        const planetMinute = (minutesSinceMidnight % 6) * 10;

        // 检查是否是新的一天
        const expectedDay = Math.floor(minutesSinceMidnight / 144) + 1;
        if (expectedDay > stats.dayCount) {
            await this.prisma.planetStats.update({
                where: { id: stats.id },
                data: { dayCount: expectedDay },
            });

            logger.info(`[Time] New day: Day ${expectedDay}`);

            // 记录新的一天事件
            await this.prisma.event.create({
                data: {
                    soulId: 0, // 系统事件
                    type: 'system',
                    content: `新的一天开始了！星球时间：第${expectedDay}天`,
                    metadata: JSON.stringify({ day: expectedDay }),
                },
            });
        }

        return {
            day: stats.dayCount,
            hour: planetHour,
            minute: planetMinute,
            timestamp: now,
        };
    }

    getPlanetTimeString(time: PlanetTime): string {
        return `第${time.day}天 ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
    }
}
