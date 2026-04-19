import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

// Dev format: colorized, human-readable
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).filter(k => k !== 'service').length
        ? ` ${JSON.stringify(Object.fromEntries(Object.entries(meta).filter(([k]) => k !== 'service')))}`
        : '';
    return `${timestamp} [${level}]${stack ? ` ${stack}` : ` ${message}`}${metaStr}`;
});

// Production format: structured JSON for Cloud Logging
const prodFormat = winston.format.combine(
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    errors({ stack: true }),
    winston.format.json()
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: 'elixopay-api' },
    transports: [
        new winston.transports.Console({
            format: isProduction
                ? prodFormat
                : combine(
                    colorize(),
                    timestamp({ format: 'HH:mm:ss' }),
                    errors({ stack: true }),
                    devFormat
                ),
        }),
    ],
});

export default logger;
