import { PrismaClient } from '@prisma/client';
import logger from '../lib/logger.js';

export interface PlanetTime {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
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
                    oxygen: 0,
                    climate: 5,
                    water: 0,
                    biomass: 0,
                    tir: 5,
                    stage: 1,
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
                hour: newHour,
                dayCount: newDay,
                month: newMonth,
                year: newYear,
                lastTickTime: now,
            },
        });

        return {
            year: newYear,
            month: newMonth,
            day: newDay,
            hour: newHour,
            minute: 0,
        };
    }

    async getCurrentPlanetTime(): Promise<PlanetTime> {
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
        const planetMinutesPassed = realMinutesPassed * 10;
        const currentMinute = Math.floor(planetMinutesPassed) % 60;

        return {
            year: stats.year,
            month: stats.month,
            day: stats.dayCount,
            hour: stats.hour,
            minute: currentMinute,
        };
    }
}

export const timeEngineInstance = new TimeEngine(new PrismaClient());