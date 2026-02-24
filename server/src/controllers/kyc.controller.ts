import logger from '../utils/logger';
import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { sendKycApprovedEmail, sendKycRejectedEmail } from '../utils/mailer';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure upload directory exists
const updateDir = path.join(__dirname, '../../uploads/kyc');
if (!fs.existsSync(updateDir)) {
    fs.mkdirSync(updateDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, updateDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename using Date + Random suffix + original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// File filter to allow only image and pdf
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

export const uploadDocuments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore - User is attached by protect middleware
    const user = req.user;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const docType = req.body.docType || 'id_card'; // 'id_card' or 'passport'
    const { bankName, bankAccountNumber, bankAccountName } = req.body;

    if (!files || !files.statement) {
        return next(new AppError('Please provide the Bank Statement document.', 400));
    }

    let idCardUrl: string;
    let idCardBackUrl: string | undefined;

    if (docType === 'id_card') {
        // Require both front and back for Thai ID cards
        if (!files.idCardFront || !files.idCardBack) {
            return next(new AppError('Please provide both front and back of your ID card.', 400));
        }
        idCardUrl = `/uploads/kyc/${files.idCardFront[0].filename}`;
        idCardBackUrl = `/uploads/kyc/${files.idCardBack[0].filename}`;
    } else {
        // Passport: single image required
        if (!files.idCard) {
            return next(new AppError('Please provide your passport photo.', 400));
        }
        idCardUrl = `/uploads/kyc/${files.idCard[0].filename}`;
    }

    const statementUrl = `/uploads/kyc/${files.statement[0].filename}`;
    const selfieUrl = files.selfie ? `/uploads/kyc/${files.selfie[0].filename}` : undefined;

    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
            kycStatus: 'pending',
            kycIdCardUrl: idCardUrl,
            kycStatementUrl: statementUrl,
            kycSubmittedAt: new Date(),
            kycRejectionReason: null, // Clear previous rejection reason on re-submit
            ...(selfieUrl && { kycSelfieUrl: selfieUrl }),
            // Save bank account info (locked after admin approval)
            ...(bankName && { bankName }),
            ...(bankAccountNumber && { bankAccountNumber }),
            ...(bankAccountName && { bankAccountName }),
        }
    });

    res.status(200).json({
        success: true,
        message: 'KYC documents uploaded successfully',
        data: {
            kycStatus: updatedUser.kycStatus
        }
    });
});

export const getPendingKyc = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const pendingRequests = await prisma.user.findMany({
        where: { kycStatus: 'pending' },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            kycStatus: true,
            kycIdCardUrl: true,
            kycStatementUrl: true,
            kycSelfieUrl: true,
            kycSubmittedAt: true,
            createdAt: true,
            bankName: true,
            bankAccountNumber: true,
            bankAccountName: true,
        },
        orderBy: { kycSubmittedAt: 'asc' }
    });

    res.status(200).json({
        success: true,
        results: pendingRequests.length,
        data: {
            users: pendingRequests
        }
    });
});

export const getAllKyc = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // Exclude users who haven't started KYC
    const kycRequests = await prisma.user.findMany({
        where: { kycStatus: { not: 'unverified' } },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            kycStatus: true,
            kycIdCardUrl: true,
            kycStatementUrl: true,
            kycSelfieUrl: true,
            kycSubmittedAt: true,
            kycVerifiedAt: true,
            kycRejectionReason: true,
            createdAt: true,
            bankName: true,
            bankAccountNumber: true,
            bankAccountName: true,
            wallet: {
                select: {
                    currency: true
                }
            }
        },
        orderBy: { kycSubmittedAt: 'desc' }
    });

    res.status(200).json({
        success: true,
        results: kycRequests.length,
        data: {
            users: kycRequests
        }
    });
});

export const verifyKyc = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = parseInt(req.params.userId, 10);
    const { status, reason } = req.body; // status: 'verified' | 'rejected'

    if (!['verified', 'rejected'].includes(status)) {
        return next(new AppError('Status must be verified or rejected', 400));
    }

    const userToUpdate = await prisma.user.findUnique({ where: { id: userId } });
    if (!userToUpdate) {
        return next(new AppError('User not found', 404));
    }

    // Get reviewing admin's email for audit trail
    const adminUser = await prisma.user.findUnique({ where: { id: (req as any).user.id }, select: { email: true } });
    const adminEmail = adminUser?.email || 'unknown';

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            kycStatus: status,
            kycVerifiedAt: new Date(),
            kycReviewedBy: adminEmail,  // BOT audit trail
            // Lock bank account when KYC is approved
            ...(status === 'verified' && { bankVerified: true, kycRejectionReason: null }),
            // Save rejection reason for user to see
            ...(status === 'rejected' && { kycRejectionReason: reason || 'เอกสารไม่ผ่านการตรวจสอบ' }),
        }
    });

    // Send email notification (non-fatal — don't let email failure break the API)
    try {
        if (status === 'verified') {
            await sendKycApprovedEmail(userToUpdate.email, userToUpdate.firstName || 'ผู้ใช้งาน');
        } else if (status === 'rejected') {
            await sendKycRejectedEmail(userToUpdate.email, userToUpdate.firstName || 'ผู้ใช้งาน', reason || 'เอกสารไม่ผ่านการตรวจสอบ');
        }
    } catch (emailErr: any) {
        logger.error('[KYC] Email send failed (non-fatal):', emailErr.message);
    }

    res.status(200).json({
        success: true,
        message: `User KYC ${status} successfully`,
        data: {
            user: {
                id: updatedUser.id,
                kycStatus: updatedUser.kycStatus
            }
        }
    });
});
