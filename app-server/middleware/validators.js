const { body, validationResult } = require('express-validator');

/**
 * Validation middleware helper
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      }
    });
  }
  next();
};

/**
 * Registration validation rules
 */
exports.validateRegistration = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 12 })
    .withMessage('Password must be at least 12 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-\[\]{}|\\:;"'<>,.\/~`])/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  validate
];

/**
 * Login validation rules
 */
exports.validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate
];

/**
 * Payment creation validation rules
 */
exports.validatePayment = [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be a positive number'),
  body('currency')
    .optional()
    .isIn(['THB', 'USD', 'EUR'])
    .withMessage('Currency must be THB, USD, or EUR'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  validate
];

/**
 * API Key creation validation rules
 */
exports.validateApiKey = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Name must be between 3 and 100 characters'),
  body('type')
    .isIn(['live', 'test'])
    .withMessage('Type must be either live or test'),
  validate
];
