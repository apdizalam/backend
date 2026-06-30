const express = require('express');
const router = express.Router();
const { initiatePay, handleWebhook } = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/initiate', protect, initiatePay);
router.post('/webhook', handleWebhook); // Webhook is public but should verify signature

router.post('/pay', async (req, res) => {
    try {
        const { customerId, supplyNo, amount, gateway, phoneNumber } = req.body;
        const Bill = require('../models/Bill.model');
        const Payment = require('../models/Payment.model');
        
        // Find latest unpaid bill for this supplyNo or customerId
        const bill = await Bill.findOne({
            $or: [{ supplyNo }, { customerId }],
            status: { $in: ['Pending', 'Overdue'] }
        }).sort({ createdAt: -1 });

        // Update the Bill to 'Paid'
        if (bill) {
            bill.status = 'Paid';
            await bill.save();
        }

        const transactionId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Create Payment record
        const payment = await Payment.create({
            bill: bill ? bill._id : null,
            customer: customerId,
            amount: Number(amount || 0),
            paymentMethod: gateway || 'MOBILE_APP',
            transactionId: transactionId,
            status: 'SUCCESS',
            paidAt: new Date()
        });

        res.status(200).json({ success: true, payment });
    } catch (error) {
        console.error('Payment pay error:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
