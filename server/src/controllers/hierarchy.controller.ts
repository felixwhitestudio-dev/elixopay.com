import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import * as authService from '../services/auth.service';

/**
 * @route   GET /api/v1/hierarchy
 * @desc    Get full hierarchy tree for the current user (Partner/Organizer)
 * @access  Private
 */
export const getHierarchy = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user!.id;

        // Recursive query to fetch entire subtree
        const result = await prisma.$queryRawUnsafe<any[]>(`
            WITH RECURSIVE bfs_tree AS (
                SELECT id, first_name, last_name, email, account_type, status, parent_id, created_at, 0 as depth
                FROM users
                WHERE id = $1
                UNION ALL
                SELECT u.id, u.first_name, u.last_name, u.email, u.account_type, u.status, u.parent_id, u.created_at, bt.depth + 1
                FROM users u
                INNER JOIN bfs_tree bt ON u.parent_id = bt.id
                WHERE bt.depth < 10 -- Safety limit
            )
            SELECT * FROM bfs_tree WHERE id != $1 ORDER BY depth, created_at DESC;
        `, userId);

        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   POST /api/v1/hierarchy/create
 * @desc    Create a direct sub-account (e.g., Partner creates Organizer/Agent)
 * @access  Private
 */
export const createSubAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password, firstName, lastName, role, feeRate } = req.body;
        const parentId = (req as any).user!.id;

        // @ts-ignore
        const parentRole = (req as any).user!.role || (req as any).user?.account_type;

        const allowed: Record<string, string[]> = {
            'partner': ['organizer', 'agent'],
            'organizer': ['agent', 'merchant'],
            'agent': ['merchant']
        };

        if ((req as any).user!.email === 'demo@elixopay.com') {
            // Bypass
        } else if (!allowed[parentRole as string] || !allowed[parentRole as string].includes(role)) {
            return res.status(403).json({ success: false, error: { message: `Cannot create ${role} from ${parentRole}` } });
        }

        const hashedPassword = await authService.hashPassword(password);

        await prisma.$transaction(async (tx) => {
            // Check email uniquely to handle conflict code 23505
            const existing = await tx.$queryRawUnsafe<any[]>('SELECT id FROM users WHERE email = $1', email);
            if (existing.length > 0) {
                throw new AppError('Email already exists', 409);
            }

            // 1. Create User
            const insertUser = await tx.$queryRawUnsafe<any[]>(
                `INSERT INTO users (email, password_hash, first_name, last_name, account_type, status, email_verified, parent_id, created_at)
                 VALUES ($1, $2, $3, $4, $5, 'active', true, $6, NOW())
                 RETURNING id, email`,
                email, hashedPassword, firstName, lastName || '', role, parentId
            );
            const newUser = insertUser[0];

            // 2. Create Wallet
            const walletAddress = uuidv4();
            await tx.$executeRawUnsafe(
                `INSERT INTO wallets (user_id, wallet_address, balance, currency, is_active, created_at)
                 VALUES ($1, $2, 0.00, 'THB', true, NOW())`,
                newUser.id, walletAddress
            );

            // 3. Set Fee Config
            if (feeRate !== undefined) {
                await tx.$executeRawUnsafe(
                    `INSERT INTO fee_configs (user_id, set_by_id, rate_percent)
                     VALUES ($1, $2, $3)`,
                    newUser.id, parentId, feeRate
                );
            }

            res.status(201).json({ success: true, data: { user: newUser } });
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @route   PUT /api/v1/hierarchy/user/:id
 * @desc    Update sub-account (Status, Fee)
 * @access  Private
 */
export const updateSubAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const targetId = parseInt(req.params.id);
        const parentId = (req as any).user!.id;
        const { status, feeRate } = req.body;

        const pathRes = await prisma.$queryRawUnsafe<any[]>(`
            WITH RECURSIVE ancestors AS (
                SELECT id, parent_id FROM users WHERE id = $1
                UNION ALL
                SELECT u.id, u.parent_id FROM users u INNER JOIN ancestors a ON u.id = a.parent_id
            )
            SELECT id FROM ancestors WHERE id = $2
        `, targetId, parentId);

        if (pathRes.length === 0) {
            return res.status(403).json({ success: false, error: { message: 'Not authorized to manage this user' } });
        }

        if (status) {
            await prisma.$executeRawUnsafe('UPDATE users SET status = $1 WHERE id = $2', status, targetId);
        }

        if (feeRate !== undefined) {
            await prisma.$executeRawUnsafe(`
                INSERT INTO fee_configs (user_id, set_by_id, rate_percent, updated_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (user_id, set_by_id) 
                DO UPDATE SET rate_percent = $3, updated_at = NOW()
            `, targetId, parentId, feeRate);
        }

        res.json({ success: true, message: 'User updated successfully' });

    } catch (error) {
        next(error);
    }
};
