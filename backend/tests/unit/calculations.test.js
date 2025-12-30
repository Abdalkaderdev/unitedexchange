/**
 * Exchange Calculation Unit Tests
 */

describe('Exchange Calculations', () => {
  describe('Currency Conversion', () => {
    const convertCurrency = (amount, rate) => {
      return Math.round(amount * rate * 100) / 100;
    };

    it('should convert USD to IQD correctly', () => {
      const usdAmount = 100;
      const rate = 1450; // 1 USD = 1450 IQD

      const iqd = convertCurrency(usdAmount, rate);
      expect(iqd).toBe(145000);
    });

    it('should convert IQD to USD correctly', () => {
      const iqdAmount = 145000;
      const rate = 1 / 1450;

      const usd = convertCurrency(iqdAmount, rate);
      expect(usd).toBeCloseTo(100, 0);
    });

    it('should handle decimal amounts', () => {
      const amount = 10.50;
      const rate = 1.25;

      const result = convertCurrency(amount, rate);
      expect(result).toBe(13.13); // 10.50 * 1.25 = 13.125 rounded to 13.13
    });
  });

  describe('Profit Calculation', () => {
    const calculateProfit = (buyRate, sellRate, amount) => {
      return Math.round((sellRate - buyRate) * amount * 100) / 100;
    };

    it('should calculate profit correctly', () => {
      const buyRate = 1450;
      const sellRate = 1455;
      const amount = 100;

      const profit = calculateProfit(buyRate, sellRate, amount);
      expect(profit).toBe(500); // (1455 - 1450) * 100 = 500 IQD profit
    });

    it('should handle zero profit (no spread)', () => {
      const buyRate = 1450;
      const sellRate = 1450;
      const amount = 100;

      const profit = calculateProfit(buyRate, sellRate, amount);
      expect(profit).toBe(0);
    });
  });

  describe('Commission Calculation', () => {
    const calculateCommission = (amount, rate) => {
      return Math.round(amount * rate * 100) / 100;
    };

    it('should calculate 1% commission correctly', () => {
      const amount = 1000;
      const commissionRate = 0.01;

      const commission = calculateCommission(amount, commissionRate);
      expect(commission).toBe(10);
    });

    it('should handle no commission', () => {
      const amount = 1000;
      const commissionRate = 0;

      const commission = calculateCommission(amount, commissionRate);
      expect(commission).toBe(0);
    });
  });

  describe('Rounding', () => {
    const roundToDecimalPlaces = (number, places) => {
      const multiplier = Math.pow(10, places);
      return Math.round(number * multiplier) / multiplier;
    };

    it('should round to 2 decimal places', () => {
      expect(roundToDecimalPlaces(10.125, 2)).toBe(10.13);
      expect(roundToDecimalPlaces(10.124, 2)).toBe(10.12);
      expect(roundToDecimalPlaces(10.5, 2)).toBe(10.5);
    });

    it('should round to 0 decimal places (integers)', () => {
      expect(roundToDecimalPlaces(10.5, 0)).toBe(11);
      expect(roundToDecimalPlaces(10.4, 0)).toBe(10);
    });
  });
});
