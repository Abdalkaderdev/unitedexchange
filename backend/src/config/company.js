/**
 * Company Configuration
 * Default values can be overridden by environment variables
 */

const companyConfig = {
  // Company Information
  name: process.env.COMPANY_NAME || 'United Exchange',
  nameArabic: process.env.COMPANY_NAME_AR || 'يونايتد للصرافة',
  nameKurdish: process.env.COMPANY_NAME_KU || 'یونایتەد بۆ ئاڵوگۆڕی دراو',

  // Address
  address: process.env.COMPANY_ADDRESS || '123 Main Street',
  addressLine2: process.env.COMPANY_ADDRESS_LINE2 || 'City Center',
  city: process.env.COMPANY_CITY || 'Erbil',
  country: process.env.COMPANY_COUNTRY || 'Iraq',

  // Contact Information
  phone: process.env.COMPANY_PHONE || '+964 750 000 0000',
  phone2: process.env.COMPANY_PHONE2 || '',
  email: process.env.COMPANY_EMAIL || 'info@unitedexchange.com',
  website: process.env.COMPANY_WEBSITE || 'www.unitedexchange.com',

  // License Information
  licenseNumber: process.env.COMPANY_LICENSE || 'License No: XXXX-XXXX',

  // Receipt Settings
  receipt: {
    // Base URL for QR code verification
    verificationBaseUrl: process.env.RECEIPT_VERIFICATION_URL || 'https://unitedexchange.com/verify',

    // Footer text - Terms and Conditions
    termsAndConditions: process.env.RECEIPT_TERMS ||
      'This receipt is valid proof of currency exchange transaction. ' +
      'Please retain this receipt for your records. ' +
      'Exchange rates are final at the time of transaction. ' +
      'For any inquiries, please contact us within 24 hours.',

    termsAndConditionsArabic: process.env.RECEIPT_TERMS_AR ||
      'هذا الإيصال هو إثبات صالح لمعاملة صرف العملات. ' +
      'يرجى الاحتفاظ بهذا الإيصال لسجلاتك. ' +
      'أسعار الصرف نهائية وقت المعاملة. ' +
      'لأي استفسارات، يرجى التواصل معنا خلال 24 ساعة.',

    termsAndConditionsKurdish: process.env.RECEIPT_TERMS_KU ||
      'ئەم پسوولەیە بەڵگەیەکی دروستە بۆ مامەڵەی ئاڵوگۆڕی دراو. ' +
      'تکایە ئەم پسوولەیە بۆ تۆمارەکانت بپارێزە. ' +
      'نرخەکانی ئاڵوگۆڕ لە کاتی مامەڵەکە کۆتاییە. ' +
      'بۆ هەر پرسیارێک، تکایە لە ماوەی 24 کاتژمێردا پەیوەندیمان پێوەبکە.',

    // Logo path (can be set via environment variable)
    logoPath: process.env.COMPANY_LOGO_PATH || null,
  },

  // Currency display settings
  currency: {
    // Default currency for profit display
    defaultProfitCurrency: process.env.DEFAULT_PROFIT_CURRENCY || 'USD',
  }
};

module.exports = companyConfig;
