const mongoose = require('mongoose');

// Meter Reading Log schema (one document = one reading entry)
const meterReadingSchema = new mongoose.Schema({
    supplyNo: {
        type: String,
        required: true,
        trim: true
    },
    // keep meterNumber alias for compatibility
    meterNumber: {
        type: String,
        required: false,
        trim: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    prevReading: {
        type: Number,
        required: true
    },
    currReading: {
        type: Number,
        required: true
    },
    unitsUsed: {
        type: Number,
        default: 0
    },
    readingDate: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compute unitsUsed before saving
meterReadingSchema.pre('save', function (next) {
    try {
        if (typeof this.currReading === 'number' && typeof this.prevReading === 'number') {
            this.unitsUsed = this.currReading - this.prevReading;
            if (this.unitsUsed < 0) this.unitsUsed = 0;
        }
        // fallback populate meterNumber from supplyNo for compatibility
        if (!this.meterNumber && this.supplyNo) this.meterNumber = this.supplyNo;
        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model('Meter', meterReadingSchema);
