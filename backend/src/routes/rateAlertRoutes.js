const express = require('express');
const router = express.Router();
const rateAlertController = require('../controllers/rateAlertController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.route('/')
    .get(rateAlertController.getAlerts)
    .post(rateAlertController.createAlert);

router.route('/:uuid')
    .delete(rateAlertController.deleteAlert);

module.exports = router;
