import { PrismaClient } from '@prisma/client';
import logger from '../lib/logger.js';

export interface PlanetTime {
    year: number;
    month: number;
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
                    year: 0,
                    month: 1,
                    dayCount: 1,
                    hour: 6,
                },
            });
        }

        const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

        let newHour = stats.hour + 1;
        let newDay = stats.dayCount;
        let newMonth = stats.month || 1;
        let newYear = stats.year || 0;

        if (newHour >= 24) {
            newHour = 0;
            newDay += 1;
            logger.info(`[Time] New day: 聚栖${newYear}年 ${newMonth}月${newDay}日`);
        }

        const days = daysInMonth[newMonth - 1];
        if (newDay > days) {
            newDay = 1;
            newMonth += 1;
            logger.info(`[Time] New month: 聚栖${newYear}年 ${newMonth}月`);
        }

        if (newMonth > 12) {
            newMonth = 1;
            newYear += 1;
            logger.info(`[Time] New year: 聚栖${newYear}年`);
        }

        await this.prisma.planetStats.update({
            where: { id: stats.id },
            data: {
                year: newYear,
                month: newMonth,
                dayCount: newDay,
                hour: newHour,
            },
        });

        return {
            year: newYear,
            month: newMonth,
            day: newDay,
            hour: newHour,
            minute: 0,
            timestamp: new Date(),
        };
    }

    getPlanetTimeString(time: PlanetTime): string {
        return `聚栖${time.year}年 ${String(time.month).padStart(2, '0')}月${String(time.day).padStart(2, '0')}日 ${String(time.hour).padStart(2, '0')}:00`;
    }
}
