const express = require('express');
const router = express.Router();
const { addMeter, addReading, getMeter, getMeters, updateMeter, deleteMeter, getLatestReading } = require('../controllers/meter.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.route('/')
    .get(protect, authorize('admin', 'cashier', 'manager'), getMeters)
    .post(protect, authorize('admin', 'manager'), addMeter);

// latest reading by supplyNo or customerId
router.get('/latest', protect, authorize('admin', 'cashier', 'manager'), getLatestReading);

router.route('/:id')
    .get(protect, authorize('admin', 'cashier', 'manager'), getMeter)
    .put(protect, authorize('admin', 'manager'), updateMeter)
    .delete(protect, authorize('admin', 'manager'), deleteMeter);

router.post('/:id/readings', protect, authorize('admin', 'cashier', 'manager'), addReading);

module.exports = router;
