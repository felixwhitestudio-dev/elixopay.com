import { AppError } from '../../utils/AppError';

describe('AppError', () => {
    it('should create an error with message and status code', () => {
        const error = new AppError('Not found', 404);

        expect(error.message).toBe('Not found');
        expect(error.statusCode).toBe(404);
        expect(error.status).toBe('fail');
        expect(error.isOperational).toBe(true);
    });

    it('should set status to "error" for 500 codes', () => {
        const error = new AppError('Server error', 500);

        expect(error.status).toBe('error');
        expect(error.isOperational).toBe(true);
    });

    it('should set status to "fail" for 4xx codes', () => {
        const err400 = new AppError('Bad request', 400);
        const err401 = new AppError('Unauthorized', 401);
        const err403 = new AppError('Forbidden', 403);

        expect(err400.status).toBe('fail');
        expect(err401.status).toBe('fail');
        expect(err403.status).toBe('fail');
    });

    it('should be an instance of Error', () => {
        const error = new AppError('Test', 400);
        expect(error).toBeInstanceOf(Error);
    });

    it('should include error code when provided', () => {
        const error = new AppError('Insufficient funds', 400, 'INSUFFICIENT_BALANCE');

        expect(error.code).toBe('INSUFFICIENT_BALANCE');
    });
});
