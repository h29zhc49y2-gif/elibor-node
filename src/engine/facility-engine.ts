import { PrismaClient, Facility } from '@prisma/client';
import logger from '../lib/logger.js';

export type FacilityType = 'oxygen' | 'climate' | 'water' | 'biomass' | 'capsule';
export type FacilityLevel = 1 | 2 | 3;
export type LocationType = 'indoor' | 'outdoor';
export type OperationType = 'auto' | 'manual';

export interface FacilityConfig {
    name: string;
    nameEn: string;
    icon: string;
    location: LocationType;
    operation: OperationType;
    soulRequired: number;
    buildCost: { mineral: number };
    tirOutput: number;
    maintenanceCost: { souls?: number; energy?: number };
}

export const FACILITY_CONFIGS: Record<FacilityType, Record<FacilityLevel, FacilityConfig>> = {
    capsule: {
        1: {
            name: '栖人飞行舱',
            nameEn: 'Habitat Pod',
            icon: 'home',
            location: 'indoor',
            operation: 'auto',
            soulRequired: 0,
            buildCost: { mineral: 0 },
            tirOutput: 5,
            maintenanceCost: {},
        },
        2: {
            name: '全能加工车间',
            nameEn: 'Workshop',
            icon: 'factory',
            location: 'indoor',
            operation: 'auto',
            soulRequired: 0,
            buildCost: { mineral: 0 },
            tirOutput: 15,
            maintenanceCost: {},
        },
        3: {
            name: '高级加工中心',
            nameEn: 'Advanced Center',
            icon: 'building',
            location: 'indoor',
            operation: 'auto',
            soulRequired: 0,
            buildCost: { mineral: 0 },
            tirOutput: 30,
            maintenanceCost: {},
        },
    },
    oxygen: {
        1: {
            name: '氧气帐篷',
            nameEn: 'Oxygen Tent',
            icon: 'wind',
            location: 'indoor',
            operation: 'manual',
            soulRequired: 1,
            buildCost: { mineral: 20 },
            tirOutput: 15,
            maintenanceCost: { souls: 1 },
        },
        2: {
            name: '氧气发生器',
            nameEn: 'Oxygen Generator',
            icon: 'wind',
            location: 'indoor',
            operation: 'manual',
            soulRequired: 2,
            buildCost: { mineral: 50 },
            tirOutput: 50,
            maintenanceCost: { souls: 2 },
        },
        3: {
            name: '氧气森林',
            nameEn: 'Oxygen Forest',
            icon: 'trees',
            location: 'outdoor',
            operation: 'auto',
            soulRequired: 0,
            buildCost: { mineral: 200 },
            tirOutput: 200,
            maintenanceCost: { energy: 10 },
        },
    },
    climate: {
        1: {
            name: '简易火堆',
            nameEn: 'Campfire',
            icon: 'flame',
            location: 'outdoor',
            operation: 'manual',
            soulRequired: 1,
            buildCost: { mineral: 10 },
            tirOutput: 10,
            maintenanceCost: { souls: 1 },
        },
        2: {
            name: '恒温器',
            nameEn: 'Thermostat',
            icon: 'thermometer',
            location: 'indoor',
            operation: 'manual',
            soulRequired: 1,
            buildCost: { mineral: 40 },
            tirOutput: 40,
            maintenanceCost: { energy: 3 },
        },
        3: {
            name: '气候调节塔',
            nameEn: 'Climate Tower',
            icon: 'cloud',
            location: 'outdoor',
            operation: 'auto',
            soulRequired: 0,
            buildCost: { mineral: 150 },
            tirOutput: 150,
            maintenanceCost: { energy: 15 },
        },
    },
    water: {
        1: {
            name: '冰晶收集器',
            nameEn: 'Ice Collector',
            icon: 'snowflake',
            location: 'outdoor',
            operation: 'manual',
            soulRequired: 1,
            buildCost: { mineral: 15 },
            tirOutput: 12,
            maintenanceCost: { souls: 1 },
        },
        2: {
            name: '净水站',
            nameEn: 'Water Station',
            icon: 'droplet',
            location: 'indoor',
            operation: 'manual',
            soulRequired: 2,
            buildCost: { mineral: 60 },
            tirOutput: 45,
            maintenanceCost: { energy: 5 },
        },
        3: {
            name: '水循环中心',
            nameEn: 'Water Center',
            icon: 'recycle',
            location: 'indoor',
            operation: 'auto',
            soulRequired: 0,
            buildCost: { mineral: 180 },
            tirOutput: 180,
            maintenanceCost: { energy: 20 },
        },
    },
    biomass: {
        1: {
            name: '简易温室',
            nameEn: 'Simple Greenhouse',
            icon: 'sprout',
            location: 'outdoor',
            operation: 'manual',
            soulRequired: 2,
            buildCost: { mineral: 30 },
            tirOutput: 20,
            maintenanceCost: {},
        },
        2: {
            name: '生态培育舱',
            nameEn: 'Eco Chamber',
            icon: 'leaf',
            location: 'indoor',
            operation: 'manual',
            soulRequired: 3,
            buildCost: { mineral: 100 },
            tirOutput: 80,
            maintenanceCost: {},
        },
        3: {
            name: '基因改良中心',
            nameEn: 'Gene Center',
            icon: 'flask',
            location: 'indoor',
            operation: 'manual',
            soulRequired: 1,
            buildCost: { mineral: 400 },
            tirOutput: 250,
            maintenanceCost: { energy: 30 },
        },
    },
};

export class FacilityEngine {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async buildFacility(
        type: FacilityType,
        level: FacilityLevel,
        name: string
    ): Promise<Facility> {
        const config = FACILITY_CONFIGS[type][level];

        const facility = await this.prisma.facility.create({
            data: {
                name,
                type,
                level,
                location: config.location,
                operation: config.operation,
                guardSoulId: config.soulRequired > 0 ? 0 : undefined,
                outputType: type,
                outputAmount: config.tirOutput,
                efficiency: 1.0,
                damage: 0,
            },
        });

        logger.info(`[Facility] Built ${config.name} (Lv.${level})`);

        return facility;
    }

    async getFacilityOutput(facility: Facility): Promise<number> {
        if (facility.damage >= 1) {
            return 0;
        }

        const effectiveEfficiency = facility.efficiency * (1 - facility.damage);
        return facility.outputAmount * effectiveEfficiency;
    }

    async processMaintenance(facilityId: number): Promise<void> {
        const facility = await this.prisma.facility.findUnique({
            where: { id: facilityId },
        });

        if (!facility) return;

        const config = FACILITY_CONFIGS[facility.type as FacilityType]?.[facility.level as FacilityLevel];
        if (!config) return;

        if (facility.operation === 'manual' && config.maintenanceCost.souls) {
            const effectiveEfficiency = 1 - (facility.damage || 0);
            await this.prisma.facility.update({
                where: { id: facilityId },
                data: { efficiency: effectiveEfficiency },
            });
        }

        if (facility.operation === 'auto' && config.maintenanceCost.energy) {
            logger.info(`[Facility] ${facility.name} consumed ${config.maintenanceCost.energy} energy`);
        }
    }

    async applyWeatherDamage(facilityId: number, outdoor: boolean, weatherDamage: number): Promise<void> {
        if (!outdoor) return;

        const facility = await this.prisma.facility.findUnique({
            where: { id: facilityId },
        });

        if (!facility) return;

        const newDamage = Math.min(1, (facility.damage || 0) + weatherDamage);

        await this.prisma.facility.update({
            where: { id: facilityId },
            data: { damage: newDamage },
        });

        logger.info(`[Facility] ${facility.name} took ${weatherDamage * 100}% damage, total: ${newDamage * 100}%`);
    }

    async getTotalOutput(facilityType?: FacilityType): Promise<number> {
        const where = facilityType ? { type: facilityType } : {};
        const facilities = await this.prisma.facility.findMany({ where });

        let total = 0;
        for (const facility of facilities) {
            total += await this.getFacilityOutput(facility);
        }

        return total;
    }

    getFacilityConfigs(): typeof FACILITY_CONFIGS {
        return FACILITY_CONFIGS;
    }
}

export const facilityEngine = new FacilityEngine(new PrismaClient());