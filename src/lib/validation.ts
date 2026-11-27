import {z} from 'zod';
export const donationSchema=z.object({campaignId:z.string().uuid(),name:z.string().trim().min(2).max(120),phone:z.string().trim().regex(/^(?:\+?254|0)(?:7|1)\d{8}$/,'Enter a valid Kenyan mobile number'),amount:z.number().int().min(50).max(150000),anonymous:z.boolean().default(false)});
