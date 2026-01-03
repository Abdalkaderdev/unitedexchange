const {
    parseDecimal,
    isPositiveDecimal,
    calculateProfit,
    convertAmount,
    sanitizeForLog
} = require('./helpers');

describe('Helper Utilities', () => {
    describe('parseDecimal', () => {
        test('should parse string integers', () => {
            expect(parseDecimal('100')).toBe(100.00);
        });

        test('should parse string floats', () => {
            expect(parseDecimal('100.50')).toBe(100.50);
        });

        test('should handle actual numbers', () => {
            expect(parseDecimal(100.5)).toBe(100.50);
        });

        test('should return null for null/undefined', () => {
            expect(parseDecimal(null)).toBeNull();
            expect(parseDecimal(undefined)).toBeNull();
        });

        test('should return null for invalid strings', () => {
            expect(parseDecimal('abc')).toBeNull();
        });
    });

    describe('isPositiveDecimal', () => {
        test('should return true for positive numbers', () => {
            expect(isPositiveDecimal(10)).toBe(true);
            expect(isPositiveDecimal('10.5')).toBe(true);
        });

        test('should return false for negative numbers', () => {
            expect(isPositiveDecimal(-5)).toBe(false);
            expect(isPositiveDecimal('-5.5')).toBe(false);
        });

        test('should return false for zero', () => {
            expect(isPositiveDecimal(0)).toBe(false);
        });

        test('should return false for non-numbers', () => {
            expect(isPositiveDecimal('abc')).toBe(false);
        });
    });

    describe('calculateProfit', () => {
        test('should calculate profit correctly from rate spread', () => {
            // Market Rate: 1.0, Applied Rate: 1.02 (2% spread)
            // Amount In: 100
            // Profit should be 100 * (1.02 - 1.00) = 2
            expect(calculateProfit(100, 1.0, 1.02)).toBe(2);
        });

        test('should handle decimal precision correctly', () => {
            // 0.1 + 0.2 usually equals 0.30000000000000004 in JS
            // Let's test if our logic handles typical floating point issues
            // Amount: 1000, Market: 1.1, Applied: 1.15 -> Spread 0.05 -> Profit 50
            expect(calculateProfit(1000, 1.1, 1.15)).toBe(50);
        });
    });

    describe('convertAmount', () => {
        test('should convert correctly', () => {
            expect(convertAmount(100, 1.5)).toBe(150.00);
        });

        test('should round to 2 decimals by default', () => {
            expect(convertAmount(100, 1.33333)).toBe(133.33);
        });
    });

    describe('sanitizeForLog', () => {
        test('should redact sensitive fields', () => {
            const input = {
                userId: 1,
                password: 'secret_password',
                token: 'xyz-123',
                data: 'safe'
            };

            const expected = {
                userId: 1,
                password: '[REDACTED]',
                token: '[REDACTED]',
                data: 'safe'
            };

            expect(sanitizeForLog(input)).toEqual(expected);
        });

        test('should handle null/undefined', () => {
            expect(sanitizeForLog(null)).toBeNull();
        });

        test('should pass through safe objects', () => {
            const input = { a: 1, b: 2 };
            expect(sanitizeForLog(input)).toEqual(input);
        });
    });
});
