const Bill = require('../models/Bill.model');
const Meter = require('../models/Meter.model');
const User = require('../models/User.model');
const { calculateBill } = require('../services/billing.service');

// @desc    Generate a bill
// @route   POST /api/bills
// @access  Private
const generateBill = async (req, res) => {
    try {
        const {
            meterNumber,
            customerId,
            supplyNo,
            idNo,
            prevDate,
            prevReading,
            currDate,
            currReading,
            billDate,
            period,
            amount,
            amountDue,
            status,
            dueDate
        } = req.body;

        // Find latest readings by supplyNo/meterNumber or customerId
        const query = {};
        if (supplyNo) query.supplyNo = supplyNo;
        else if (meterNumber) query.meterNumber = meterNumber;
        else if (customerId) query.customerId = customerId;

        const readings = Object.keys(query).length > 0 ? await Meter.find(query).sort({ readingDate: -1 }).limit(2) : [];

        // Determine readings: prefer explicit values from request, else infer from reading log
        let computedCurrReading = typeof currReading === 'number' ? currReading : (readings.length > 0 ? readings[0].currReading : 0);
        let computedPrevReading = typeof prevReading === 'number' ? prevReading : (readings.length > 1 ? readings[1].currReading : (readings.length > 0 ? readings[0].prevReading : 0));
        let computedCurrDate = currDate ? new Date(currDate) : (readings.length > 0 ? readings[0].readingDate : new Date());
        let computedPrevDate = prevDate ? new Date(prevDate) : (readings.length > 1 ? readings[1].readingDate : null);

        // Compute units
        let units = 0;
        if (typeof computedCurrReading === 'number' && typeof computedPrevReading === 'number') {
            units = computedCurrReading - computedPrevReading;
            if (units < 0) units = 0;
        }

        // Compute amountDue via billing service when possible
        let finalAmountDue = 0;
        try {
            const calc = calculateBill(computedPrevReading, computedCurrReading);
            finalAmountDue = calc.amount;
        } catch (err) {
            finalAmountDue = 0;
        }

        // If manual amount provided (either `amount` or `amountDue`) use it
        const manualAmount = (amount !== undefined && amount !== null && amount !== '') ? amount : (amountDue !== undefined && amountDue !== null && amountDue !== '' ? amountDue : undefined);
        if (manualAmount !== undefined) {
            const parsed = parseFloat(manualAmount);
            if (isNaN(parsed)) return res.status(400).json({ message: 'Invalid amount format' });
            finalAmountDue = parsed;
        }

        // Resolve customer name if available
        let customerName = '';
        if (customerId) {
            const user = await User.findById(customerId);
            if (user) customerName = user.fullName || '';
        }

        // Fallback check to support pending mobile app users
        let meterNoToUse = null;
        if (customerId) {
            const cust = await User.findById(customerId);
            if (cust) {
                meterNoToUse = cust.meterNumber || req.body.supplyNo || req.body.meterNumber || req.body.idNo || "PENDING";
            }
        }

        // Normalize status to backend enum values (capitalized)
        const normalizeStatus = (s) => {
            if (!s) return 'Pending';
            const v = String(s).toLowerCase();
            if (v === 'paid') return 'Paid';
            if (v === 'overdue') return 'Overdue';
            return 'Pending';
        };

        const latest = readings.length > 0 ? readings[0] : null;

        const bill = await Bill.create({
            customerId: customerId || (latest ? latest.customerId : null),
            supplyNo: supplyNo || (latest ? (latest.supplyNo || latest.meterNumber) : undefined) || meterNoToUse || "PENDING",
            idNo: idNo || undefined,
            customerName: customerName || undefined,
            prevDate: computedPrevDate,
            prevReading: computedPrevReading,
            currDate: computedCurrDate,
            currReading: computedCurrReading,
            units: units,
            unitsUsed: units,
            billDate: billDate ? new Date(billDate) : new Date(),
            period: period || undefined,
            amountDue: finalAmountDue,
            status: normalizeStatus(status),
            dueDate: dueDate ? new Date(dueDate) : new Date(new Date().setDate(new Date().getDate() + 14))
        });
        const populatedBill = await Bill.findById(bill._id).populate('customerId', 'fullName');
        const out = populatedBill.toObject();
        out.customerName = out.customerName || (out.customerId && out.customerId.fullName) || '';
        out.amountDue = out.amountDue !== undefined ? out.amountDue : out.amount;

        res.status(201).json(out);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a bill
// @route   PUT /api/bills/:id
// @access  Private
const updateBill = async (req, res) => {
    try {
        const updates = { ...req.body };

        // If readings are being updated, recalc units
        if (updates.currReading !== undefined || updates.prevReading !== undefined) {
            const existing = await Bill.findById(req.params.id);
            if (!existing) return res.status(404).json({ message: 'Bill not found' });

            const curr = typeof updates.currReading === 'number' ? updates.currReading : existing.currReading;
            const prev = typeof updates.prevReading === 'number' ? updates.prevReading : existing.prevReading;
            updates.units = (typeof curr === 'number' && typeof prev === 'number') ? Math.max(0, curr - prev) : existing.units;
            updates.unitsUsed = updates.units;
        }

        // Normalize status if provided (capitalized)
        if (updates.status !== undefined) updates.status = (function(s){ if(!s) return 'Pending'; const low = String(s).toLowerCase(); if (low === 'paid') return 'Paid'; if (low === 'overdue') return 'Overdue'; return 'Pending'; })(updates.status);

        // If amountDue provided as amount or amountDue, normalize to amountDue
        if (updates.amount !== undefined && updates.amount !== null) {
            updates.amountDue = Number(updates.amount);
            delete updates.amount;
        }

        const bill = await Bill.findByIdAndUpdate(req.params.id, updates, { new: true }).populate('customerId', 'fullName');
        if (!bill) {
            return res.status(404).json({ message: 'Bill not found' });
        }

        const out = bill.toObject();
        out.customerName = out.customerName || (out.customerId && out.customerId.fullName) || '';
        out.unitsUsed = out.unitsUsed !== undefined ? out.unitsUsed : out.units;
        out.amountDue = out.amountDue !== undefined ? out.amountDue : out.amount;

        res.status(200).json(out);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a bill
// @route   DELETE /api/bills/:id
// @access  Private
const deleteBill = async (req, res) => {
    try {
        const bill = await Bill.findByIdAndDelete(req.params.id);
        if (!bill) {
            return res.status(404).json({ message: 'Bill not found' });
        }
        res.status(200).json({ message: 'Bill deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get bills for a customer
// @route   GET /api/bills/customer/:customerId
// @access  Private
const getCustomerBills = async (req, res) => {
    try {
        // If requester is a customer, ensure they can only fetch their own bills
        if (req.user && req.user.role === 'customer') {
            if (String(req.user._id) !== String(req.params.customerId)) {
                return res.status(403).json({ message: 'Forbidden' });
            }
        }

        const query = { customerId: req.params.customerId };
        if (req.query.status) {
            const statusLower = req.query.status.toLowerCase();
            if (statusLower === 'unpaid') {
                query.status = { $in: ['Pending', 'Overdue'] };
            } else if (statusLower === 'paid') {
                query.status = 'Paid';
            } else {
                query.status = req.query.status.charAt(0).toUpperCase() + req.query.status.slice(1).toLowerCase();
            }
        }

        const bills = await Bill.find(query).sort({ createdAt: -1 }).populate('customerId', 'fullName');
        const out = bills.map(b => {
            const o = b.toObject();
            o.customerName = o.customerName || (o.customerId && o.customerId.fullName) || '';
            // expose unitsUsed for frontend, fallback to units
            o.unitsUsed = o.unitsUsed !== undefined ? o.unitsUsed : o.units;
            o.amountDue = o.amountDue !== undefined ? o.amountDue : o.amount;
            return o;
        });
        res.status(200).json(out);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAllBills = async (req, res) => {
    try {
        const queryFilter = {};
        if (req.query.customerId) {
            queryFilter.customerId = req.query.customerId;
        }
        const matchingRecords = await Bill.find(queryFilter).populate('customerId');
        res.json(matchingRecords);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Pay a bill directly
// @route   POST /api/bills/:id/pay
// @access  Private
const payBill = async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id);
        if (!bill) {
            return res.status(404).json({ message: 'Bill not found' });
        }

        // If requester is a customer, ensure they can only pay their own bills
        if (req.user && req.user.role === 'customer') {
            if (String(req.user._id) !== String(bill.customerId)) {
                return res.status(403).json({ message: 'Forbidden' });
            }
        }

        bill.status = 'Paid';
        await bill.save();

        // Also create a successful payment log
        const Payment = require('../models/Payment.model');
        await Payment.create({
            bill: bill._id,
            customer: bill.customerId,
            amount: bill.amountDue || bill.amount || 0,
            paymentMethod: 'MOBILE_APP',
            transactionId: `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
            status: 'SUCCESS',
            paidAt: new Date()
        });

        res.status(200).json({ message: 'Bill paid successfully', bill });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    generateBill,
    updateBill,
    deleteBill,
    getCustomerBills,
    getAllBills,
    payBill
};
