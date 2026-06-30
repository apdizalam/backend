const Bill = require('../models/Bill.model');

const calculateBill = (previousReading, currentReading, pricePerUnit = 1.5) => {
    const consumption = currentReading - previousReading;
    if (consumption < 0) {
        throw new Error('Current reading cannot be less than previous reading');
    }
    const amount = consumption * pricePerUnit;
    return { consumption, amount };
};

const generateInvoice = async (customerId, month) => {
    // Logic to generate invoice PDF or similar could go here
    return `Invoice for ${customerId} - ${month}`;
};

module.exports = {
    calculateBill,
    generateInvoice
};
