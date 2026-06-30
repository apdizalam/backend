const Payment = require('../models/Payment.model');
const Bill = require('../models/Bill.model');
const Meter = require('../models/Meter.model');
const { initiatePayment, verifyPayment } = require('../services/sifalo.service');

// @desc    Initiate payment
// @route   POST /api/payments/initiate
// @access  Private
const initiatePay = async (req, res) => {
    try {
        console.log('InitiatePay called with body:', JSON.stringify(req.body));
        let { meterNumber, amount, phoneNumber, gateway } = req.body;

        // Normalize meter number (trim + uppercase) to avoid case/whitespace mismatches
        if (typeof meterNumber === 'string') {
            meterNumber = meterNumber.trim().toUpperCase();
        }

        console.log('Normalized meterNumber:', meterNumber, 'gateway:', gateway);

        // Find latest meter reading by supplyNo/meterNumber
        const reading = await Meter.findOne({ supplyNo: meterNumber }).sort({ readingDate: -1 });
        console.log('Meter reading lookup result for', meterNumber, ':', reading);
        if (!reading) {
            return res.status(404).json({ message: 'Meter reading not found with number: ' + meterNumber });
        }

        // Find the latest unpaid bill for this supplyNo or customer
        const bill = await Bill.findOne({
            $or: [ { supplyNo: reading.supplyNo }, { customerId: reading.customerId } ],
            status: { $in: ['Pending', 'Overdue'] }
        }).sort({ createdAt: -1 });

        if (!bill) {
            return res.status(404).json({ message: 'No unpaid bills found for this meter' });
        }

        if (bill.status === 'PAID') {
            return res.status(400).json({ message: 'Bill is already paid' });
        }

        // Call SifaloPay

        // Basic validation: ensure account type matches gateway expectations
        let accountValue = phoneNumber || '';
        // Remove whitespace
        accountValue = accountValue.replace(/\s+/g, '');
        
        // Auto-detect gateway from phone number if possible
        // 61, 77 -> waafi (Hormuud)
        // 63 -> zaad (Telesom)
        // 68, 65 -> edahab (Somtel)
        let detectedGateway = null;
        // Check for common prefixes (accounting for optional 252 or +252)
        const phoneDigits = accountValue.replace(/^(\+?252)?/, '');
        
        if (/^(61|77)/.test(phoneDigits)) {
            detectedGateway = 'zaad'; // User requested zaad for waafi numbers
        } else if (/^63/.test(phoneDigits)) {
            detectedGateway = 'zaad';
        } else if (/^(68|65)/.test(phoneDigits)) {
            detectedGateway = 'edahab'; 
        }

        // Map common frontend gateway identifiers to provider-expected values
        const GATEWAY_MAP = {
            telesom: 'zaad',
            zaad: 'zaad',
            edahab: 'edahab',
            somtel: 'edahab',
            waafi: 'zaad', // Map waafi input to zaad
            hormuud: 'zaad'
        };

        // Determine final gateway: Detected > Mapped Input > Default
        let providerGateway = detectedGateway;
        
        if (!providerGateway) {
            providerGateway = (gateway && typeof gateway === 'string') 
                ? (GATEWAY_MAP[gateway.toLowerCase()] || 'zaad') // Default to zaad
                : 'zaad';
        }

        // Keep standard naming if detected
        if (detectedGateway && providerGateway !== detectedGateway) {
             console.log(`Gateway mismatch. Input mapped to ${providerGateway} but detected ${detectedGateway}. Using detected.`);
             providerGateway = detectedGateway;
        }

        console.log(`Detected Gateway: ${detectedGateway}, Input Gateway: ${gateway}, Final: ${providerGateway}`);
        
        const isNumericAccount = /^\d{6,20}$/.test(accountValue);
        
        if (!isNumericAccount) {
            return res.status(400).json({ message: 'Invalid account format. Provide phone/wallet number (digits only).' });
        }

        // Determine currency based on amount magnitude
        // Amounts > 500 are likely local currency (SLSH/SOS) not USD
        let currency = 'USD';
        const numAmount = parseFloat(amount);
        if (!isNaN(numAmount) && numAmount >= 500) {
            const digits = accountValue.replace(/^(\+?252)?/, '');
            if (/^(61|77)/.test(digits)) {
                currency = 'SOS'; // Hormuud uses Somali Shilling
            } else {
                currency = 'SLSH'; // Zaad and others use Somaliland Shilling
            }
        }
        

        // Override currency if 'waafi' gateway is selected but the amount suggests a USD transaction (e.g. < 500)
        // However, if the user explicitly requests USD, we might need a flag. 
        // For now, heuristic: small amounts = USD, large amounts = Local.

        const paymentData = {
            account: accountValue,
            gateway: providerGateway,
            amount: String(amount),
            currency: currency,
            order_id: bill._id.toString(), // optional, but useful
        };

        // Note: In a real app, we should use our public domain for callback.
        // Since this is localhost, we might need a tunnel or just simulate.

        const sifaloResponse = await initiatePayment(paymentData);

        // Create Payment record
        const transactionId = sifaloResponse.sid || `TRANS_${Date.now()}`;
        // Map response code to payment status
        let paymentStatus = 'PENDING';
        if (sifaloResponse.code === '601') paymentStatus = 'SUCCESS';
        else if (sifaloResponse.code === '603') paymentStatus = 'PENDING';
        else paymentStatus = 'FAILED';

        const payment = await Payment.create({
            bill: bill._id,
            customer: bill.customer,
            amount,
            paymentMethod: 'SIFALOPAY',
            transactionId,
            status: paymentStatus
        });

        res.status(200).json({ payment, sifaloResponse, billInfo: { billId: bill.billId, month: bill.month } });
    }catch (error) {
        console.error('Payment initiation error:', error);
        res.status(500).json({
            message: error.message,
            details: error.response?.data || 'No additional details available'
        });
    }
};

// @desc    SifaloPay Webhook
// @route   POST /api/payments/webhook
// @access  Public (should be secured by signature verification)
const handleWebhook = async (req, res) => {
    try {
        const { transactionId, status, metadata } = req.body;

        // Verify signature (omitted for brevity, but crucial in prod)

        if (status === 'SUCCESS') {
            const payment = await Payment.findOne({ transactionId });
            if (payment) {
                payment.status = 'SUCCESS';
                payment.paidAt = Date.now();
                await payment.save();

                // Update Bill status
                const bill = await Bill.findById(payment.bill);
                if (bill) {
                    bill.status = 'PAID';
                    await bill.save();
                }
            }
        } else if (status === 'FAILED') {
            const payment = await Payment.findOne({ transactionId });
            if (payment) {
                payment.status = 'FAILED';
                await payment.save();
            }
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Webhook Error' });
    }
};

module.exports = {
    initiatePay,
    handleWebhook
};
