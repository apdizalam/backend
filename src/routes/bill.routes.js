const express = require('express');
const router = express.Router();
const { generateBill, getCustomerBills, getAllBills, updateBill, deleteBill, payBill } = require('../controllers/bill.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.route('/')
    .get(protect, authorize('admin', 'cashier', 'manager', 'customer'), getAllBills)
    .post(protect, authorize('admin', 'manager'), generateBill);

router.route('/:id')
    .put(protect, authorize('admin', 'manager'), updateBill)
    .delete(protect, authorize('admin', 'manager'), deleteBill);

router.post('/:id/pay', protect, payBill);

router.get('/customer/:customerId', protect, authorize('admin', 'cashier', 'manager', 'customer'), getCustomerBills);

module.exports = router;
