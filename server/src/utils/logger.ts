import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).filter(k => k !== 'service').length
        ? ` ${JSON.stringify(Object.fromEntries(Object.entries(meta).filter(([k]) => k !== 'service')))}`
        : '';
    return `${timestamp} [${level}]${stack ? ` ${stack}` : ` ${message}`}${metaStr}`;
});

const logDir = path.join(process.cwd(), 'logs');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: 'elixopay-api' },
    transports: [
        // Console: colorized, human-readable
        new winston.transports.Console({
            format: combine(
                colorize(),
                timestamp({ format: 'HH:mm:ss' }),
                errors({ stack: true }),
                consoleFormat
            )
        }),
        // File: all logs (info+)
        new winston.transports.File({
            filename: path.join(logDir, 'app.log'),
            format: combine(
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                errors({ stack: true }),
                winston.format.json()
            ),
            maxsize: 5 * 1024 * 1024, // 5MB per file
            maxFiles: 5,              // Keep last 5 files
        }),
        // File: errors only
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            format: combine(
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                errors({ stack: true }),
                winston.format.json()
            ),
            maxsize: 5 * 1024 * 1024,
            maxFiles: 10,
        }),
    ],
});

export default logger;
