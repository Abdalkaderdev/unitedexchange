/**
 * Currency Controller
 * Production-ready with exchange rate history tracking and comprehensive audit logging
 */
const { pool } = require('../config/database');
const { logAudit, getClientIp, parseDecimal } = require('../utils/helpers');

const getCurrencies = async (req, res, next) => {
  try {
    const { active } = req.query;

    let query = 'SELECT id, code, name, symbol, is_active, created_at, updated_at FROM currencies';
    const params = [];

    if (active !== undefined) {
      query += ' WHERE is_active = ?';
      params.push(active === 'true');
    }

    query += ' ORDER BY code ASC';

    const [currencies] = await pool.query(query, params);

    res.json({
      success: true,
      data: currencies.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        isActive: c.is_active,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      }))
    });
  } catch (error) {
    next(error);
  }
};

const createCurrency = async (req, res, next) => {
  try {
    const { code, name, symbol } = req.body;

    const [result] = await pool.query(
      'INSERT INTO currencies (code, name, symbol) VALUES (?, ?, ?)',
      [code.toUpperCase(), name, symbol]
    );

    await logAudit(
      req.user.id,
      'CREATE',
      'currencies',
      result.insertId,
      null,
      { code: code.toUpperCase(), name, symbol },
      getClientIp(req)
    );

    res.status(201).json({
      success: true,
      message: 'Currency created successfully.',
      data: {
        id: result.insertId,
        code: code.toUpperCase(),
        name,
        symbol
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateCurrency = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, symbol, isActive } = req.body;

    const [currencies] = await pool.query('SELECT * FROM currencies WHERE id = ?', [id]);

    if (currencies.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Currency not found.'
      });
    }

    const oldCurrency = currencies[0];

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (symbol !== undefined) {
      updates.push('symbol = ?');
      params.push(symbol);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update.'
      });
    }

    params.push(id);

    await pool.query(`UPDATE currencies SET ${updates.join(', ')} WHERE id = ?`, params);

    await logAudit(
      req.user.id,
      'UPDATE',
      'currencies',
      id,
      { name: oldCurrency.name, symbol: oldCurrency.symbol, isActive: oldCurrency.is_active },
      { name, symbol, isActive },
      getClientIp(req)
    );

    res.json({
      success: true,
      message: 'Currency updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

const getExchangeRates = async (req, res, next) => {
  try {
    const [rates] = await pool.query(`
      SELECT
        er.id,
        er.buy_rate,
        er.sell_rate,
        er.updated_at,
        fc.id as from_currency_id,
        fc.code as from_currency_code,
        fc.name as from_currency_name,
        fc.symbol as from_currency_symbol,
        tc.id as to_currency_id,
        tc.code as to_currency_code,
        tc.name as to_currency_name,
        tc.symbol as to_currency_symbol,
        u.full_name as updated_by_name
      FROM exchange_rates er
      JOIN currencies fc ON er.from_currency_id = fc.id
      JOIN currencies tc ON er.to_currency_id = tc.id
      JOIN users u ON er.updated_by = u.id
      WHERE fc.is_active = TRUE AND tc.is_active = TRUE
      ORDER BY fc.code, tc.code
    `);

    res.json({
      success: true,
      data: rates.map(r => ({
        id: r.id,
        fromCurrency: {
          id: r.from_currency_id,
          code: r.from_currency_code,
          name: r.from_currency_name,
          symbol: r.from_currency_symbol
        },
        toCurrency: {
          id: r.to_currency_id,
          code: r.to_currency_code,
          name: r.to_currency_name,
          symbol: r.to_currency_symbol
        },
        buyRate: parseFloat(r.buy_rate),
        sellRate: parseFloat(r.sell_rate),
        updatedAt: r.updated_at,
        updatedByName: r.updated_by_name
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Set exchange rate with history tracking
 * Logs all rate changes to exchange_rate_history table
 */
const setExchangeRate = async (req, res, next) => {
  try {
    const { fromCurrencyId, toCurrencyId, buyRate, sellRate } = req.body;
    const ipAddress = getClientIp(req);

    // Parse rates with proper decimal precision
    const parsedBuyRate = parseDecimal(buyRate, 6);
    const parsedSellRate = parseDecimal(sellRate, 6);

    // Verify currencies exist
    const [currencies] = await pool.query(
      'SELECT id, code FROM currencies WHERE id IN (?, ?) AND is_active = TRUE',
      [fromCurrencyId, toCurrencyId]
    );

    if (currencies.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Invalid currency IDs or currencies are not active.'
      });
    }

    // Check if rate exists
    const [existing] = await pool.query(
      'SELECT id, buy_rate, sell_rate FROM exchange_rates WHERE from_currency_id = ? AND to_currency_id = ?',
      [fromCurrencyId, toCurrencyId]
    );

    let result;
    let action;
    let oldValues = null;

    if (existing.length > 0) {
      const oldBuyRate = parseDecimal(existing[0].buy_rate, 6);
      const oldSellRate = parseDecimal(existing[0].sell_rate, 6);

      // Log rate change to history table before updating
      await pool.query(
        `INSERT INTO exchange_rate_history
          (exchange_rate_id, from_currency_id, to_currency_id, old_buy_rate, new_buy_rate,
           old_sell_rate, new_sell_rate, changed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          existing[0].id,
          fromCurrencyId,
          toCurrencyId,
          oldBuyRate,
          parsedBuyRate,
          oldSellRate,
          parsedSellRate,
          req.user.id
        ]
      );

      // Update existing rate
      await pool.query(
        'UPDATE exchange_rates SET buy_rate = ?, sell_rate = ?, updated_by = ? WHERE id = ?',
        [parsedBuyRate, parsedSellRate, req.user.id, existing[0].id]
      );
      result = { id: existing[0].id };
      action = 'RATE_CHANGE';
      oldValues = { buyRate: oldBuyRate, sellRate: oldSellRate };
    } else {
      // Insert new rate
      const [insertResult] = await pool.query(
        'INSERT INTO exchange_rates (from_currency_id, to_currency_id, buy_rate, sell_rate, updated_by) VALUES (?, ?, ?, ?, ?)',
        [fromCurrencyId, toCurrencyId, parsedBuyRate, parsedSellRate, req.user.id]
      );
      result = { id: insertResult.insertId };
      action = 'CREATE';

      // Log initial rate to history
      await pool.query(
        `INSERT INTO exchange_rate_history
          (exchange_rate_id, from_currency_id, to_currency_id, old_buy_rate, new_buy_rate,
           old_sell_rate, new_sell_rate, changed_by)
         VALUES (?, ?, ?, NULL, ?, NULL, ?, ?)`,
        [result.id, fromCurrencyId, toCurrencyId, parsedBuyRate, parsedSellRate, req.user.id]
      );
    }

    // Log audit with appropriate severity
    await logAudit(
      req.user.id,
      action,
      'exchange_rates',
      result.id,
      oldValues,
      { fromCurrencyId, toCurrencyId, buyRate: parsedBuyRate, sellRate: parsedSellRate },
      ipAddress,
      action === 'RATE_CHANGE' ? 'warning' : 'info'
    );

    res.json({
      success: true,
      message: 'Exchange rate saved successfully.',
      data: {
        id: result.id,
        fromCurrencyId,
        toCurrencyId,
        buyRate: parsedBuyRate,
        sellRate: parsedSellRate
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get exchange rate history for a currency pair
 */
const getExchangeRateHistory = async (req, res, next) => {
  try {
    const { fromCurrencyId, toCurrencyId, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT
        h.*,
        u.full_name as changed_by_name,
        fc.code as from_currency_code,
        tc.code as to_currency_code
      FROM exchange_rate_history h
      JOIN users u ON h.changed_by = u.id
      JOIN currencies fc ON h.from_currency_id = fc.id
      JOIN currencies tc ON h.to_currency_id = tc.id
      WHERE 1=1
    `;
    const params = [];

    if (fromCurrencyId) {
      query += ' AND h.from_currency_id = ?';
      params.push(fromCurrencyId);
    }
    if (toCurrencyId) {
      query += ' AND h.to_currency_id = ?';
      params.push(toCurrencyId);
    }

    // Count query
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    query += ' ORDER BY h.changed_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [history] = await pool.query(query, params);

    res.json({
      success: true,
      data: history.map(h => ({
        id: h.id,
        fromCurrency: h.from_currency_code,
        toCurrency: h.to_currency_code,
        oldBuyRate: parseDecimal(h.old_buy_rate, 6),
        newBuyRate: parseDecimal(h.new_buy_rate, 6),
        oldSellRate: parseDecimal(h.old_sell_rate, 6),
        newSellRate: parseDecimal(h.new_sell_rate, 6),
        changedBy: h.changed_by_name,
        changedAt: h.changed_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCurrencies,
  createCurrency,
  updateCurrency,
  getExchangeRates,
  setExchangeRate,
  getExchangeRateHistory
};
