const db = require('../config/database');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|pdf/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images and PDFs are allowed'));
    }
});

/**
 * @desc Upload Verification Document
 * @route POST /api/v1/verification/upload
 * @access Private
 */
exports.uploadDocument = [
    upload.single('document'),
    async (req, res, next) => {
        const client = await db.pool.connect();
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }

            const { type } = req.body; // id_card, business_reg, etc.
            const userId = req.user.id;

            if (!type) {
                return res.status(400).json({ success: false, message: 'Document type is required' });
            }

            await client.query('BEGIN');

            // Insert document record
            const insertRes = await client.query(
                `INSERT INTO documents (user_id, type, file_path, status)
                 VALUES ($1, $2, $3, 'pending')
                 RETURNING id, type, status, created_at`,
                [userId, type, req.file.path]
            );

            // Update user status to 'pending' if it was 'unverified' or 'rejected'
            // But usually this happens when they click "Submit Application".
            // For now, let's keep it 'pending' on the document level. 
            // The user must explicitly request review in a separate step?
            // Or auto-update user to pending?
            // Let's implement a 'submit application' endpoint separately, or do it here.
            // Let's do it separately to allow multiple file uploads before "Submitting".

            await client.query('COMMIT');

            res.json({
                success: true,
                data: insertRes.rows[0],
                message: 'Document uploaded successfully'
            });

        } catch (error) {
            await client.query('ROLLBACK');
            // Cleanup file if DB fail
            if (req.file) fs.unlinkSync(req.file.path);
            next(error);
        } finally {
            client.release();
        }
    }
];

/**
 * @desc Submit Verification Request
 * @route POST /api/v1/verification/submit
 * @access Private
 */
exports.submitVerification = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Check if user has uploaded necessary docs
        // For simplicity, require at least 1 doc
        const docCheck = await db.query('SELECT COUNT(*) FROM documents WHERE user_id = $1', [userId]);
        if (parseInt(docCheck.rows[0].count) === 0) {
            return res.status(400).json({ success: false, message: 'Please upload documents first' });
        }

        await db.query(`UPDATE users SET verification_status = 'pending' WHERE id = $1`, [userId]);

        res.json({ success: true, message: 'Verification application submitted' });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc Get My Verification Status
 * @route GET /api/v1/verification/status
 * @access Private
 */
exports.getVerificationStatus = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRes = await db.query('SELECT verification_status, risk_level FROM users WHERE id = $1', [userId]);
        const docsRes = await db.query('SELECT id, type, status, rejection_reason, created_at FROM documents WHERE user_id = $1', [userId]);

        res.json({
            success: true,
            data: {
                status: userRes.rows[0].verification_status,
                riskLevel: userRes.rows[0].risk_level,
                documents: docsRes.rows
            }
        });
    } catch (error) {
        next(error);
    }
};
