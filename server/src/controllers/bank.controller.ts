import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { sendBankApprovedEmail, sendBankRejectedEmail } from '../utils/mailer';

// =============================================
// USER: Submit a bank account change request
// =============================================
export const submitChangeRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const user = req.user;
    const { newBankName, newAccountNumber, newAccountName, reason } = req.body;

    if (!newBankName || !newAccountNumber || !newAccountName || !reason) {
        return next(new AppError('Please provide all required fields: newBankName, newAccountNumber, newAccountName, reason', 400));
    }

    // Check if there is already a pending request
    const existing = await prisma.bankAccountChangeRequest.findFirst({
        where: { userId: user.id, status: 'pending' }
    });
    if (existing) {
        return next(new AppError('You already have a pending bank account change request. Please wait for admin review.', 409));
    }

    // KYC must be verified before allowing any change
    const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!fullUser || fullUser.kycStatus !== 'verified') {
        return next(new AppError('Your KYC must be verified before you can change your bank account.', 403));
    }

    const changeRequest = await prisma.bankAccountChangeRequest.create({
        data: {
            userId: user.id,
            newBankName,
            newAccountNumber,
            newAccountName,
            reason,
            status: 'pending'
        }
    });

    res.status(201).json({
        success: true,
        message: 'Bank account change request submitted. Pending admin review.',
        data: { request: changeRequest }
    });
});

// =============================================
// USER: Get my bank account info + any pending request
// =============================================
export const getMyBankInfo = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const user = req.user;

    const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
            bankName: true,
            bankAccountNumber: true,
            bankAccountName: true,
            bankVerified: true,
        }
    });

    const pendingRequest = await prisma.bankAccountChangeRequest.findFirst({
        where: { userId: user.id, status: 'pending' }
    });

    res.status(200).json({
        success: true,
        data: {
            bank: fullUser,
            pendingRequest: pendingRequest || null
        }
    });
});

// =============================================
// ADMIN: List all pending change requests
// =============================================
export const listChangeRequests = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { status = 'pending' } = req.query;

    const requests = await prisma.bankAccountChangeRequest.findMany({
        where: { status: status as string },
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    bankName: true,
                    bankAccountNumber: true,
                    bankAccountName: true,
                    bankVerified: true,
                }
            }
        },
        orderBy: { createdAt: 'asc' }
    });

    res.status(200).json({
        success: true,
        results: requests.length,
        data: { requests }
    });
});

// =============================================
// ADMIN: Approve a change request
// =============================================
export const approveChangeRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const admin = req.user;
    const requestId = parseInt(req.params.id, 10);
    const { adminNote } = req.body;

    const changeRequest = await prisma.bankAccountChangeRequest.findUnique({ where: { id: requestId }, include: { user: true } });
    if (!changeRequest) return next(new AppError('Change request not found', 404));
    if (changeRequest.status !== 'pending') return next(new AppError('This request has already been resolved', 400));

    // Update in a transaction: update user bank + resolve the request + write audit log
    await prisma.$transaction([
        prisma.user.update({
            where: { id: changeRequest.userId },
            data: {
                bankName: changeRequest.newBankName,
                bankAccountNumber: changeRequest.newAccountNumber,
                bankAccountName: changeRequest.newAccountName,
                bankVerified: true
            }
        }),
        prisma.bankAccountChangeRequest.update({
            where: { id: requestId },
            data: {
                status: 'approved',
                adminNote: adminNote || 'Approved',
                resolvedAt: new Date()
            }
        }),
        prisma.auditLog.create({
            data: {
                userId: admin.id,
                action: 'BANK_CHANGE_APPROVED',
                entityType: 'BankAccountChangeRequest',
                entityId: String(requestId),
                details: `Approved bank change for user ${changeRequest.userId}: ${changeRequest.newBankName} ${changeRequest.newAccountNumber} (${changeRequest.newAccountName})`
            }
        })
    ]);

    // Send email notification (non-fatal)
    try {
        if (changeRequest.user && changeRequest.user.email) {
            await sendBankApprovedEmail(
                changeRequest.user.email,
                changeRequest.user.firstName || 'ผู้ใช้งาน',
                changeRequest.newBankName
            );
        }
    } catch (emailErr: any) {
        console.error('[Bank] Email send failed (non-fatal):', emailErr.message);
    }

    res.status(200).json({
        success: true,
        message: 'Bank account change approved and updated successfully.'
    });
});

// =============================================
// ADMIN: Reject a change request
// =============================================
export const rejectChangeRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const admin = req.user;
    const requestId = parseInt(req.params.id, 10);
    const { adminNote } = req.body;

    if (!adminNote) return next(new AppError('Please provide a reason for rejection (adminNote is required)', 400));

    const changeRequest = await prisma.bankAccountChangeRequest.findUnique({ where: { id: requestId }, include: { user: true } });
    if (!changeRequest) return next(new AppError('Change request not found', 404));
    if (changeRequest.status !== 'pending') return next(new AppError('This request has already been resolved', 400));

    await prisma.$transaction([
        prisma.bankAccountChangeRequest.update({
            where: { id: requestId },
            data: {
                status: 'rejected',
                adminNote,
                resolvedAt: new Date()
            }
        }),
        prisma.auditLog.create({
            data: {
                userId: admin.id,
                action: 'BANK_CHANGE_REJECTED',
                entityType: 'BankAccountChangeRequest',
                entityId: String(requestId),
                details: `Rejected bank change for user ${changeRequest.userId}. Reason: ${adminNote}`
            }
        })
    ]);

    // Send email notification (non-fatal)
    try {
        if (changeRequest.user && changeRequest.user.email) {
            await sendBankRejectedEmail(
                changeRequest.user.email,
                changeRequest.user.firstName || 'ผู้ใช้งาน',
                adminNote
            );
        }
    } catch (emailErr: any) {
        console.error('[Bank] Email send failed (non-fatal):', emailErr.message);
    }

    res.status(200).json({
        success: true,
        message: 'Bank account change request rejected.'
    });
});
