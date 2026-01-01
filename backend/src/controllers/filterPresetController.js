/**
 * Filter Preset Controller
 * Manages saved filter configurations for users
 */
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

/**
 * Get filter presets for a resource type
 */
const getPresets = async (req, res, next) => {
  try {
    const { resourceType } = req.query;
    const userId = req.user.id;

    let query = `
      SELECT uuid, name, resource_type, filters, is_default, created_at
      FROM filter_presets
      WHERE user_id = ?
    `;
    const params = [userId];

    if (resourceType) {
      query += ' AND resource_type = ?';
      params.push(resourceType);
    }

    query += ' ORDER BY is_default DESC, name ASC';

    const [presets] = await pool.query(query, params);

    res.json({
      success: true,
      data: presets.map(p => ({
        uuid: p.uuid,
        name: p.name,
        resourceType: p.resource_type,
        filters: typeof p.filters === 'string' ? JSON.parse(p.filters) : p.filters,
        isDefault: !!p.is_default,
        createdAt: p.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new filter preset
 */
const createPreset = async (req, res, next) => {
  try {
    const { name, resourceType, filters, isDefault } = req.body;
    const userId = req.user.id;
    const uuid = uuidv4();

    // If this is set as default, unset other defaults for this resource type
    if (isDefault) {
      await pool.query(
        'UPDATE filter_presets SET is_default = FALSE WHERE user_id = ? AND resource_type = ?',
        [userId, resourceType]
      );
    }

    await pool.query(
      `INSERT INTO filter_presets (uuid, user_id, name, resource_type, filters, is_default)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuid, userId, name, resourceType, JSON.stringify(filters), isDefault || false]
    );

    res.status(201).json({
      success: true,
      message: 'Filter preset created successfully.',
      data: { uuid, name, resourceType, filters, isDefault: isDefault || false }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a filter preset
 */
const updatePreset = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { name, filters, isDefault } = req.body;
    const userId = req.user.id;

    // Verify ownership
    const [presets] = await pool.query(
      'SELECT * FROM filter_presets WHERE uuid = ? AND user_id = ?',
      [uuid, userId]
    );

    if (presets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Filter preset not found.'
      });
    }

    const preset = presets[0];

    // If setting as default, unset others
    if (isDefault) {
      await pool.query(
        'UPDATE filter_presets SET is_default = FALSE WHERE user_id = ? AND resource_type = ? AND uuid != ?',
        [userId, preset.resource_type, uuid]
      );
    }

    await pool.query(
      `UPDATE filter_presets SET name = ?, filters = ?, is_default = ? WHERE uuid = ?`,
      [name || preset.name, filters ? JSON.stringify(filters) : preset.filters, isDefault ?? preset.is_default, uuid]
    );

    res.json({
      success: true,
      message: 'Filter preset updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a filter preset
 */
const deletePreset = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const userId = req.user.id;

    const [result] = await pool.query(
      'DELETE FROM filter_presets WHERE uuid = ? AND user_id = ?',
      [uuid, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Filter preset not found.'
      });
    }

    res.json({
      success: true,
      message: 'Filter preset deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPresets,
  createPreset,
  updatePreset,
  deletePreset
};
