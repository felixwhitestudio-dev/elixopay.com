import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import * as authService from '../services/auth.service';
import jwt from 'jsonwebtoken';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/mailer';
import crypto from 'crypto';

export const register = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email, password, firstName, lastName } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        return next(new AppError('Email already in use', 400));
    }

    const hashedPassword = await authService.hashPassword(password);
    const verification = authService.generateVerificationToken();
    const merchantId = await authService.generateMerchantId();

    const newUser = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            merchantId,
            isEmailVerified: false,
            verifyToken: verification.hashedToken,
            verifyTokenExpires: verification.expires,
            wallet: {
                create: {
                    balance: 0.00,
                    currency: 'THB'
                }
            }
        },
        include: { wallet: true }
    });

    const verifyUrl = `${process.env.APP_URL || 'http://localhost:8080'}/verify-email.html?token=${verification.token}`;

    // Fire and forget email
    sendVerificationEmail(newUser.email, newUser.firstName || 'User', verifyUrl).catch(err => {
        console.error('Failed to send verification email:', err);
    });

    // We do NOT sign in the user immediately, they must verify first.
    // However, the frontend might expect a token or specific status.
    // Let's return success but tell frontend to show verification screen.

    res.status(201).json({
        success: true,
        status: 'REQUIRE_VERIFICATION',
        message: 'Registration successful. Please verify your email.',
        data: {
            email: newUser.email
        }
    });
});

export const login = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new AppError('Please provide email and password', 400));
    }

    const user = await prisma.user.findUnique({ where: { email }, include: { wallet: true } });

    if (!user || !(await authService.comparePassword(password, user.password))) {
        return next(new AppError('Incorrect email or password', 401));
    }

    if (!user.isEmailVerified) {
        return res.status(403).json({
            success: false,
            status: 'UNVERIFIED',
            message: 'Please verify your email address to continue.',
            data: { email: user.email }
        });
    }

    if (user.isActive === false) {
        return next(new AppError('Your account has been suspended. Please contact support.', 403));
    }

    const token = authService.signToken(user.id);

    res.status(200).json({
        success: true,
        token, // Send token at root level for dashboard compatibility
        data: {
            token, // Also send inside data for consistency
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                wallet: user.wallet
            }
        }
    });
});

export const me = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore - User is attached by protect middleware
    let user = req.user;

    // Auto-generate wallet if missing (fail-safe for legacy or incomplete accounts)
    if (!user.wallet) {
        try {
            const newWallet = await prisma.wallet.create({
                data: { userId: user.id, balance: 0.0, currency: 'THB' }
            });
            user.wallet = newWallet;
        } catch (err) {
            console.error('Failed to auto-generate wallet in /me endpoint:', err);
        }
    }

    res.status(200).json({
        success: true,
        data: {
            user
        }
    });
});

export const verifyPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore - User is attached by protect middleware
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
        return next(new AppError('Please provide your password', 400));
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !(await authService.comparePassword(password, user.password))) {
        return res.status(401).json({
            success: false,
            message: 'Incorrect password',
            error: { message: 'Incorrect password' }
        });
    }

    // Optional: Return a short-lived signed action token if you want robust stateless re-auth.
    // For now, returning success true is enough for the frontend to proceed.
    const actionToken = jwt.sign(
        { id: user.id, action: 'sensitive_operation' },
        process.env.JWT_SECRET || 'super-secret-dev-key',
        { expiresIn: '5m' }
    );

    res.status(200).json({
        success: true,
        message: 'Password verified',
        data: {
            actionToken
        }
    });
});

export const googleLogin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { accessToken } = req.body;
    if (!accessToken) return next(new AppError('No token provided', 400));

    // Fetch user info from Google
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
        return next(new AppError('Invalid Google token', 401));
    }

    const payload = await response.json();
    const email = payload.email;

    if (!email) {
        return next(new AppError('No email found from Google account', 400));
    }

    let user = await prisma.user.findUnique({ where: { email }, include: { wallet: true } });

    if (user) {
        // Existing user: direct login
        if (user.isActive === false) return next(new AppError('Your account has been suspended.', 403));

        const token = authService.signToken(user.id);
        return res.status(200).json({
            success: true,
            status: 'SUCCESS',
            token,
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    wallet: user.wallet
                }
            }
        });
    } else {
        // New user: Redirect to profile completion
        // Issue a short-lived temporary token encoding the verified email
        const tempToken = jwt.sign({ email, google: true }, process.env.JWT_SECRET || 'super-secret-dev-key', { expiresIn: '15m' });

        return res.status(200).json({
            success: true,
            status: 'REQUIRE_COMPLETION',
            data: { tempToken, email }
        });
    }
});

export const completeGoogleProfile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { tempToken, firstName, lastName } = req.body;

    if (!tempToken || !firstName || !lastName || firstName.trim() === '' || lastName.trim() === '') {
        return next(new AppError('Please provide all required fields (First and Last Name)', 400));
    }

    let decoded: any;
    try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET || 'super-secret-dev-key');
    } catch (err) {
        return next(new AppError('Invalid or expired temporary token. Please sign in with Google again.', 401));
    }

    if (!decoded.email || !decoded.google) {
        return next(new AppError('Invalid token content', 401));
    }

    const existingUser = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (existingUser) {
        return next(new AppError('User already exists', 400));
    }

    // Generate a strong random password for Google-only users
    const randomPassword = await authService.hashPassword(Math.random().toString(36).slice(-10) + 'A1!');
    const merchantId = await authService.generateMerchantId();

    const newUser = await prisma.user.create({
        data: {
            email: decoded.email,
            password: randomPassword,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            merchantId,
            isEmailVerified: true, // Auto-verify Google users
            wallet: { create: { balance: 0.00, currency: 'THB' } }
        },
        include: { wallet: true }
    });

    const token = authService.signToken(newUser.id);

    res.status(201).json({
        success: true,
        token,
        data: {
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                role: newUser.role,
                wallet: newUser.wallet
            }
        }
    });
});

export const verifyEmail = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { token } = req.body;

    if (!token) {
        return next(new AppError('Verification token is missing', 400));
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
        where: {
            verifyToken: hashedToken,
            verifyTokenExpires: { gt: new Date() }
        }
    });

    if (!user) {
        return next(new AppError('Token is invalid or has expired', 400));
    }

    await prisma.user.update({
        where: { id: user.id },
        data: {
            isEmailVerified: true,
            verifyToken: null,
            verifyTokenExpires: null
        }
    });

    // Provide login token immediately after verify so user doesn't have to login again
    const jwtToken = authService.signToken(user.id);

    res.status(200).json({
        success: true,
        message: 'Email verified successfully',
        token: jwtToken
    });
});

export const resendVerification = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body;

    if (!email) {
        return next(new AppError('Please provide email', 400));
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        return next(new AppError('No user found with that email', 404));
    }

    if (user.isEmailVerified) {
        return next(new AppError('Email is already verified', 400));
    }

    const verification = authService.generateVerificationToken();

    await prisma.user.update({
        where: { id: user.id },
        data: {
            verifyToken: verification.hashedToken,
            verifyTokenExpires: verification.expires
        }
    });

    const verifyUrl = `${process.env.APP_URL || 'http://localhost:8080'}/verify-email.html?token=${verification.token}`;

    sendVerificationEmail(user.email, user.firstName || 'User', verifyUrl).catch(err => {
        console.error('Failed to resend verification email:', err);
    });

    res.status(200).json({
        success: true,
        message: 'Verification email sent'
    });
});

export const forgotPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body;
    if (!email) {
        return next(new AppError('Please provide an email address', 400));
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        // Return 200 to prevent email enumeration attacks
        return res.status(200).json({
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent.'
        });
    }

    // Generate reset token
    const resetTokenData = authService.generatePasswordResetToken();

    await prisma.user.update({
        where: { id: user.id },
        data: {
            resetPasswordToken: resetTokenData.hashedToken,
            resetPasswordExpires: resetTokenData.expires
        }
    });

    const resetUrl = `${process.env.APP_URL || 'http://localhost:8080'}/reset-password.html?token=${resetTokenData.token}`;

    try {
        await sendPasswordResetEmail(user.email, user.firstName || 'User', resetUrl);
        res.status(200).json({
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent.'
        });
    } catch (err) {
        // If email fails, clear the token
        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetPasswordToken: null,
                resetPasswordExpires: null
            }
        });
        return next(new AppError('There was an error sending the email. Try again later.', 500));
    }
});

export const resetPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
        return next(new AppError('Please provide a new password', 400));
    }

    // 1) Get user based on the token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
        where: {
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { gt: new Date() }
        }
    });

    // 2) If token has not expired, and there is user, set the new password
    if (!user) {
        return next(new AppError('Token is invalid or has expired', 400));
    }

    const hashedPassword = await authService.hashPassword(password);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            resetPasswordToken: null,
            resetPasswordExpires: null
        }
    });

    // 3) Log the user in, send JWT
    const jwtToken = authService.signToken(user.id);

    res.status(200).json({
        success: true,
        message: 'Password reset successfully',
        token: jwtToken,
        data: {
            token: jwtToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        }
    });
});
