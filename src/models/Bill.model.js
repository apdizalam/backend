const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
    supplyNo: { type: String, required: true },
    idNo: { type: Number },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    prevReading: { type: Number },
    currReading: { type: Number },
    prevDate: { type: Date },
    currDate: { type: Date },
    previousDate: { type: Date },
    currentDate: { type: Date },
    units: { type: Number, default: 0 },
    unitsUsed: { type: Number, default: 0 },

    amountDue: { type: Number, required: true },
    period: { type: String },
    dueDate: { type: Date },
    status: {
        type: String,
        enum: ['Pending', 'Paid', 'Overdue'],
        default: 'Pending'
    },

    invoiceNo: { type: String },
    billId: { type: String, unique: true, sparse: true },
    createdAt: { type: Date, default: Date.now }
});

// Generate Custom Bill ID before saving
// Ensure unitsUsed is consistent before saving and generate billId for new bills
// Compute `units` before saving and generate billId when new
billSchema.pre('save', async function (next) {
    try {
        if (typeof this.currReading === 'number' && typeof this.prevReading === 'number') {
            this.units = this.currReading - this.prevReading;
            if (this.units < 0) this.units = 0;
        }

        // Keep legacy-compatible `unitsUsed` in sync with `units`
        if (this.units !== undefined) this.unitsUsed = this.units;

        if (this.isNew) {
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const prefix = `BILL-${year}${month}-`;
            const lastBill = await this.constructor.findOne({ billId: { $regex: new RegExp(`^${prefix}`) } }).sort({ billId: -1 });
            let seq = '0001';
            if (lastBill && lastBill.billId) {
                const parts = lastBill.billId.split('-');
                const lastSeq = parseInt(parts[2] || '0');
                seq = String(lastSeq + 1).padStart(4, '0');
            }
            this.billId = `${prefix}${seq}`;
        }

        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model('Bill', billSchema);
