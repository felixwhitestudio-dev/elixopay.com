import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import * as authService from '../services/auth.service';

/**
 * @desc Get real partner statistics
 * @route GET /api/v1/partners/stats
 * @access Private
 */
export const getPartnerStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user!.id;

        // 1. Find Agency for this user
        const memberRes = await prisma.$queryRawUnsafe<any[]>(
            `SELECT agency_id, role_in_agency FROM agency_members WHERE user_id = $1 AND is_active = true LIMIT 1`,
            userId
        );

        if (memberRes.length === 0) {
            // User is not a partner yet
            return res.json({
                success: true,
                data: {
                    isPartner: false,
                    stats: null
                }
            });
        }

        const agencyId = memberRes[0].agency_id;

        // 2. Get Balance
        const balanceRes = await prisma.$queryRawUnsafe<any[]>(
            `SELECT available_amount, pending_amount, currency FROM agency_balances WHERE agency_id = $1`,
            agencyId
        );
        const balance = balanceRes[0] || { available_amount: 0, pending_amount: 0, currency: 'THB' };

        // 3. Get Total Lifetime Earnings (Sum of all COMMISSIONS credited)
        const earningsRes = await prisma.$queryRawUnsafe<any[]>(
            `SELECT SUM(amount) as total FROM ledger_entries 
       WHERE agency_id = $1 AND type = 'COMMISSION' AND direction = 'C'`,
            agencyId
        );
        const totalEarnings = parseFloat(earningsRes[0]?.total || 0);

        // 4. Get Referrals Count (Members + Merchant Sites)
        const referralsRes = await prisma.$queryRawUnsafe<any[]>(
            `SELECT COUNT(*) as count FROM merchant_sites WHERE agency_id = $1`,
            agencyId
        );
        const referralsCount = parseInt(referralsRes[0]?.count || 0);

        // 5. Click data — uses link_clicks table if it exists, otherwise returns 0
        let clicks = 0;
        try {
            const clicksRes = await prisma.$queryRawUnsafe<any[]>(
                `SELECT COUNT(*) as count FROM link_clicks WHERE agency_id = $1`, agencyId
            );
            clicks = parseInt(clicksRes[0]?.count || 0);
        } catch (e) {
            clicks = 0;
        }

        res.json({
            success: true,
            data: {
                isPartner: true,
                agencyId,
                stats: {
                    totalEarnings,
                    balance: parseFloat(balance.available_amount),
                    pendingBalance: parseFloat(balance.pending_amount),
                    referrals: referralsCount,
                    clicks: clicks,
                    currency: balance.currency
                }
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc Get payout history
 * @route GET /api/v1/partners/payouts
 * @access Private
 */
export const getPayoutHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user!.id;

        // 1. Find Agency
        const memberRes = await prisma.$queryRawUnsafe<any[]>(
            `SELECT agency_id FROM agency_members WHERE user_id = $1 LIMIT 1`,
            userId
        );

        if (memberRes.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const agencyId = memberRes[0].agency_id;

        // 2. Query Withdrawal Requests
        const payoutsRes = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, amount, currency, status, method, created_at 
       FROM withdrawal_requests 
       WHERE agency_id = $1 
       ORDER BY created_at DESC LIMIT 20`,
            agencyId
        );

        res.json({
            success: true,
            data: payoutsRes
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc Request a withdrawal
 * @route POST /api/v1/partners/withdraw
 * @access Private
 */
export const requestWithdrawal = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user!.id;
        const { amount, bankName, accountNumber, accountName } = req.body;
        const withdrawAmount = parseFloat(amount);

        // 1. Check Verification Status
        // @ts-ignore
        if ((req as any).user?.verification_status !== 'verified') {
            return res.status(403).json({
                success: false,
                message: 'Account must be verified to withdraw funds. Please go to the Verification tab.'
            });
        }

        // 2. Validate Amount
        if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }

        if (!bankName || !accountNumber || !accountName) {
            return res.status(400).json({ success: false, message: 'Missing bank details' });
        }

        // Start Transaction
        await prisma.$transaction(async (tx) => {
            // 1. Find Agency
            const memberRes = await tx.$queryRawUnsafe<any[]>(
                `SELECT agency_id FROM agency_members WHERE user_id = $1 LIMIT 1`,
                userId
            );

            if (memberRes.length === 0) {
                throw new AppError('Not authorized as partner', 403);
            }
            const agencyId = memberRes[0].agency_id;

            // 2. Check Balance (and Lock Row)
            const balanceRes = await tx.$queryRawUnsafe<any[]>(
                `SELECT available_amount, currency FROM agency_balances WHERE agency_id = $1 FOR UPDATE`,
                agencyId
            );

            if (balanceRes.length === 0) {
                throw new AppError('No wallet found', 400);
            }

            const currentBalance = parseFloat(balanceRes[0].available_amount);
            const currency = balanceRes[0].currency;

            if (currentBalance < withdrawAmount) {
                throw new AppError('Insufficient balance', 400);
            }

            // 3. Deduct Balance
            await tx.$executeRawUnsafe(
                `UPDATE agency_balances 
                 SET available_amount = available_amount - $1, 
                     reserved_amount = reserved_amount + $1 
                 WHERE agency_id = $2`,
                withdrawAmount, agencyId
            );

            // 4. Create Withdrawal Request
            const destination = {
                bank_name: bankName,
                account_number: accountNumber,
                account_name: accountName
            };

            const withdrawRes = await tx.$queryRawUnsafe<any[]>(
                `INSERT INTO withdrawal_requests (agency_id, amount, currency, status, method, destination_details, requested_by)
                 VALUES ($1, $2, $3, 'PENDING', 'BANK_TRANSFER', $4, $5)
                 RETURNING id`,
                agencyId, withdrawAmount, currency, JSON.stringify(destination), userId
            );
            const withdrawalId = withdrawRes[0].id;

            // 5. Create Ledger Entry
            await tx.$executeRawUnsafe(
                `INSERT INTO ledger_entries (agency_id, type, direction, amount, currency, status, withdrawal_request_id, description)
                 VALUES ($1, 'WITHDRAWAL', 'D', $2, $3, 'PENDING', $4, 'Withdrawal Request')`,
                agencyId, withdrawAmount, currency, withdrawalId
            );

            res.json({
                success: true,
                data: {
                    message: 'Withdrawal requested successfully',
                    newBalance: currentBalance - withdrawAmount
                }
            });
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc Get partner network (referred merchants)
 * @route GET /api/v1/partners/network
 * @access Private
 */
export const getPartnerNetwork = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user!.id;

        // 1. Find Agency
        const memberRes = await prisma.$queryRawUnsafe<any[]>(
            `SELECT agency_id FROM agency_members WHERE user_id = $1 AND is_active = true LIMIT 1`,
            userId
        );

        if (memberRes.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const agencyId = memberRes[0].agency_id;

        // 2. Query Merchant Sites (The Network)
        const merchantsRes = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, name, domain, status, created_at, contact_email 
             FROM merchant_sites 
             WHERE agency_id = $1 
             ORDER BY created_at DESC LIMIT 50`,
            agencyId
        );

        res.json({
            success: true,
            data: merchantsRes
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc Get Team (Downline Users) based on Hierarchy
 * @route GET /api/v1/partners/team
 * @access Private
 */
export const getTeam = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user!.id;

        const teamRes = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, email, first_name, last_name, account_type, status, created_at 
             FROM users 
             WHERE parent_id = $1 
             ORDER BY created_at DESC`,
            userId
        );

        res.json({
            success: true,
            data: teamRes
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc Create a new team member (Direct Creation)
 * @route POST /api/v1/partners/team/create
 * @access Private
 */
export const createTeamMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user!.id;
        // @ts-ignore
        const userRole = (req as any).user!.role || (req as any).user?.account_type; // handle different naming conventions
        const { email, password, firstName, lastName, role } = req.body;

        if (!email || !password || !firstName || !role) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const allowedRoles: Record<string, string[]> = {
            'partner': ['organizer', 'agent', 'merchant'],
            'organizer': ['agent', 'merchant'],
            'agent': ['merchant']
        };

        if (!allowedRoles[userRole as string] || !allowedRoles[userRole as string].includes(role)) {
            return res.status(403).json({ success: false, message: `You (${userRole}) cannot create a ${role}` });
        }

        // Check overlap
        const existing = await prisma.$queryRawUnsafe<any[]>('SELECT id FROM users WHERE email = $1', email);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Email already exists' });
        }

        const hashedPassword = await authService.hashPassword(password);
        const inviteCode = crypto.randomBytes(4).toString('hex');

        await prisma.$transaction(async (tx) => {
            const insertRes = await tx.$queryRawUnsafe<any[]>(
                `INSERT INTO users (email, password_hash, first_name, last_name, account_type, status, email_verified, parent_id, invite_code, created_at)
                 VALUES ($1, $2, $3, $4, $5, 'active', true, $6, $7, CURRENT_TIMESTAMP)
                 RETURNING id, email, first_name, last_name, account_type, created_at`,
                email, hashedPassword, firstName, lastName || '', role, userId, inviteCode
            );
            const newUser = insertRes[0];

            const walletAddress = uuidv4();
            await tx.$executeRawUnsafe(
                `INSERT INTO wallets (user_id, wallet_address, balance, currency, is_active, created_at)
                 VALUES ($1, $2, 0, 'THB', true, CURRENT_TIMESTAMP)`,
                newUser.id, walletAddress
            );

            res.status(201).json({
                success: true,
                data: newUser,
                message: 'Member created successfully'
            });
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc Get Commission Logs
 * @route GET /api/v1/partners/commissions
 * @access Private
 */
export const getCommissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user!.id;
        const commRes = await prisma.$queryRawUnsafe<any[]>(
            `SELECT c.*, u.first_name, u.last_name, u.email
             FROM commission_logs c
             JOIN users u ON c.source_user_id = u.id
             WHERE c.beneficiary_id = $1
             ORDER BY c.created_at DESC`,
            userId
        );

        res.json({
            success: true,
            data: commRes
        });
    } catch (error) {
        next(error);
    }
};
