const User = require('../models/User.model');
const Bill = require('../models/Bill.model');

// @route   GET /api/dashboard/stats
const getDashboardStats = async (req, res) => {
    try {
        const customers = await User.countDocuments({ role: 'customer' });
        const billsPaid = await Bill.countDocuments({ status: 'Paid' });
        const overdue = await Bill.countDocuments({ status: 'Overdue' });
        const paidBills = await Bill.find({ status: 'Paid' }).select('amountDue');
        const revenue = paidBills.reduce((sum, bill) => sum + (bill.amountDue || 0), 0);

        res.status(200).json({
            customers,
            billsPaid,
            overdue,
            revenue,
        });
    } catch (error) {
        console.error('Dashboard stats error:', error.message);
        res.status(200).json({
            customers: 0,
            billsPaid: 0,
            overdue: 0,
            revenue: 0,
        });
    }
};

// @route   GET /api/transactions
const getRecentTransactions = (req, res) => {
    res.status(200).json([
        {
            _id: 't1',
            reference: 'TX-9981',
            type: 'Billing Bill Generated',
            status: 'Completed',
            amount: 45.0,
            date: '2026-05-23',
        },
        {
            _id: 't2',
            reference: 'TX-9982',
            type: 'Customer Creation Registered',
            status: 'Completed',
            amount: 0.0,
            date: '2026-05-23',
        },
    ]);
};

module.exports = { getDashboardStats, getRecentTransactions };
