/**
 * Validation Unit Tests
 */

describe('Input Validation', () => {
  describe('Email Validation', () => {
    const isValidEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    it('should accept valid email addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('user.name@example.com')).toBe(true);
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@.com')).toBe(false);
    });
  });

  describe('Currency Code Validation', () => {
    const isValidCurrencyCode = (code) => {
      return /^[A-Z]{3}$/.test(code);
    };

    it('should accept valid 3-letter currency codes', () => {
      expect(isValidCurrencyCode('USD')).toBe(true);
      expect(isValidCurrencyCode('EUR')).toBe(true);
      expect(isValidCurrencyCode('IQD')).toBe(true);
    });

    it('should reject invalid currency codes', () => {
      expect(isValidCurrencyCode('usd')).toBe(false); // lowercase
      expect(isValidCurrencyCode('US')).toBe(false); // too short
      expect(isValidCurrencyCode('USDD')).toBe(false); // too long
      expect(isValidCurrencyCode('123')).toBe(false); // numbers
    });
  });

  describe('Amount Validation', () => {
    const isValidAmount = (amount) => {
      return typeof amount === 'number' && amount > 0 && isFinite(amount);
    };

    it('should accept valid positive amounts', () => {
      expect(isValidAmount(100)).toBe(true);
      expect(isValidAmount(0.01)).toBe(true);
      expect(isValidAmount(1000000)).toBe(true);
    });

    it('should reject invalid amounts', () => {
      expect(isValidAmount(0)).toBe(false);
      expect(isValidAmount(-100)).toBe(false);
      expect(isValidAmount('100')).toBe(false);
      expect(isValidAmount(Infinity)).toBe(false);
      expect(isValidAmount(NaN)).toBe(false);
    });
  });

  describe('UUID Validation', () => {
    const isValidUUID = (uuid) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(uuid);
    };

    it('should accept valid UUIDs', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('Phone Number Validation', () => {
    const isValidPhone = (phone) => {
      // Allow various phone formats
      return phone && phone.length >= 7 && phone.length <= 20 && /^[\d\s\-\+\(\)]+$/.test(phone);
    };

    it('should accept valid phone numbers', () => {
      expect(isValidPhone('+1-234-567-8900')).toBe(true);
      expect(isValidPhone('(234) 567-8900')).toBe(true);
      expect(isValidPhone('07701234567')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(isValidPhone('123')).toBe(false); // too short
      expect(isValidPhone('abc123')).toBe(false); // contains letters
      expect(isValidPhone('')).toBe(false);
      expect(isValidPhone(null)).toBe(false);
    });
  });
});
