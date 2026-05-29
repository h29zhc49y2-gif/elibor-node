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
    private lastTickRealTime: number | null = null;

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
                    lastTickTime: new Date(),
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

        const now = new Date();
        await this.prisma.planetStats.update({
            where: { id: stats.id },
            data: {
                year: newYear,
                month: newMonth,
                dayCount: newDay,
                hour: newHour,
                lastTickTime: now,
            },
        });

        this.lastTickRealTime = now.getTime();

        return {
            year: newYear,
            month: newMonth,
            day: newDay,
            hour: newHour,
            minute: 0,
            timestamp: now,
        };
    }

    async getCurrentPlanetTime(): Promise<PlanetTime> {
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
                    lastTickTime: new Date(),
                },
            });
        }

        const lastTickTime = stats.lastTickTime ? stats.lastTickTime.getTime() : Date.now();
        const now = Date.now();
        const realMinutesPassed = (now - lastTickTime) / 60000;

        const maxRealMinutesPassed = 10;
        const clampedRealMinutes = Math.min(realMinutesPassed, maxRealMinutesPassed);
        const planetMinutesPassed = clampedRealMinutes * 10;

        let totalMinutes = stats.hour * 60 + planetMinutesPassed;
        let newHour = Math.floor(totalMinutes / 60) % 24;
        let newMinute = Math.floor(totalMinutes % 60);

        let newDay = stats.dayCount;
        let newMonth = stats.month || 1;
        let newYear = stats.year || 0;

        const hoursPassed = Math.floor(totalMinutes / 60);
        if (hoursPassed > 0) {
            const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            let totalHoursToAdd = hoursPassed;

            while (totalHoursToAdd > 0) {
                const hoursLeftInDay = 24 - newHour;
                if (totalHoursToAdd >= hoursLeftInDay) {
                    totalHoursToAdd -= hoursLeftInDay;
                    newDay += 1;
                    newHour = 0;

                    const days = daysInMonth[newMonth - 1];
                    if (newDay > days) {
                        newDay = 1;
                        newMonth += 1;
                        if (newMonth > 12) {
                            newMonth = 1;
                            newYear += 1;
                        }
                    }
                } else {
                    newHour += totalHoursToAdd;
                    totalHoursToAdd = 0;
                }
            }
        }

        return {
            year: newYear,
            month: newMonth,
            day: newDay,
            hour: newHour,
            minute: newMinute,
            timestamp: new Date(),
        };
    }

    getPlanetTimeString(time: PlanetTime): string {
        return `聚栖${time.year}年 ${String(time.month).padStart(2, '0')}月${String(time.day).padStart(2, '0')}日 ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
    }

    getPlanetTimeStringEn(time: PlanetTime): string {
        return `Year ${time.year} ${String(time.month).padStart(2, '0')}/${String(time.day).padStart(2, '0')} ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
    }
}
