const express = require('express');
const router = express.Router();
const { getCustomers, createCustomer, updateCustomer, deleteCustomer } = require('../controllers/customer.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.route('/')
    .get(protect, authorize('admin', 'cashier', 'manager'), getCustomers)
    .post(protect, authorize('admin', 'cashier', 'manager'), createCustomer);

router.route('/:id')
    .put(protect, authorize('admin', 'manager'), updateCustomer)
    .delete(protect, authorize('admin', 'manager'), deleteCustomer);

router.post('/update-password', async (req, res) => {
    try {
        const { customerId, oldPassword, newPassword } = req.body;
        const User = require('../models/User.model');
        const account = await User.findById(customerId);
        if (!account) {
            return res.status(404).json({ message: "Customer not found" });
        }
        const checkValid = (account.password === oldPassword.toString().trim());
        if (!checkValid) {
            return res.status(400).json({ message: "Current password input is incorrect" });
        }
        account.password = newPassword.toString().trim();
        await account.save();
        res.sendStatus(200);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
