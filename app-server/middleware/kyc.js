/**
 * Middleware to enforce KYC verification before allowing access to sensitive routes.
 * Must be used after authentication middleware (e.g. `authenticate` in auth.js)
 */
const requireKyc = (req, res, next) => {
    // req.user is populated by the authenticate middleware
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Please log in to access this feature' });
    }

    // Admins bypass KYC restrictions
    if (req.user.role === 'admin') {
        return next();
    }

    // Check if the user's KYC status is verified
    if (req.user.kycStatus !== 'verified') {
        return res.status(403).json({
            success: false,
            error: 'KYC Verification Required: You must complete identity verification before using this feature.'
        });
    }

    next();
};

module.exports = requireKyc;
