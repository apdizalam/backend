const Meter = require('../models/Meter.model');
const User = require('../models/User.model');

// @desc    Get all meter readings (Meter Reading Log)
// @route   GET /api/meters
// @access  Private
const getMeters = async (req, res) => {
    try {
        // return latest readings first
        const meters = await Meter.find().sort({ readingDate: -1 }).populate('customerId', 'fullName');
        const out = meters.map(m => ({
            _id: m._id,
            supplyNo: m.supplyNo || m.meterNumber || '',
            customerId: m.customerId || null,
            customerName: (m.customerId && m.customerId.fullName) || '',
            prevReading: m.prevReading,
            currReading: m.currReading,
            unitsUsed: m.unitsUsed,
            readingDate: m.readingDate,
            createdAt: m.createdAt
        }));
        res.status(200).json(out);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add a meter reading log entry
// @route   POST /api/meters
// @access  Private
const addMeter = async (req, res) => {
    try {
        const { supplyNo, meterNumber, customerId, prevReading, currReading, readingDate } = req.body;

        const customer = await User.findById(customerId);
        if (!customer || customer.role !== 'customer') {
            return res.status(404).json({ message: 'Customer not found' });
        }

        const entry = await Meter.create({
            supplyNo: supplyNo || meterNumber,
            meterNumber: meterNumber || supplyNo,
            customerId,
            prevReading,
            currReading,
            readingDate: readingDate || Date.now()
        });

        res.status(201).json(entry);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a meter reading entry
// @route   PUT /api/meters/:id
// @access  Private
const updateMeter = async (req, res) => {
    try {
        const meter = await Meter.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!meter) return res.status(404).json({ message: 'Meter reading not found' });
        res.status(200).json(meter);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a meter reading entry
// @route   DELETE /api/meters/:id
// @access  Private
const deleteMeter = async (req, res) => {
    try {
        const meter = await Meter.findByIdAndDelete(req.params.id);
        if (!meter) return res.status(404).json({ message: 'Meter reading not found' });
        res.status(200).json({ message: 'Meter reading deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add a (legacy) reading - kept for compatibility (creates a reading entry)
// @route   POST /api/meters/:id/readings
// @access  Private
const addReading = async (req, res) => {
    try {
        // create a new Meter reading entry using parent meter id as customer reference if possible
        const { reading, date } = req.body;
        const parent = await Meter.findById(req.params.id);
        if (!parent) return res.status(404).json({ message: 'Meter not found' });
        const entry = await Meter.create({
            supplyNo: parent.supplyNo || parent.meterNumber,
            meterNumber: parent.meterNumber || parent.supplyNo,
            customerId: parent.customerId,
            prevReading: parent.currReading || 0,
            currReading: reading,
            readingDate: date || Date.now()
        });
        res.status(201).json(entry);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get a single meter reading entry by id
// @route   GET /api/meters/:id
// @access  Private
const getMeter = async (req, res) => {
    try {
        const meter = await Meter.findById(req.params.id).populate('customerId', 'fullName');
        if (!meter) return res.status(404).json({ message: 'Meter reading not found' });
        const out = {
            _id: meter._id,
            supplyNo: meter.supplyNo,
            customerId: meter.customerId,
            customerName: meter.customerId?.fullName || '',
            prevReading: meter.prevReading,
            currReading: meter.currReading,
            unitsUsed: meter.unitsUsed,
            readingDate: meter.readingDate,
            createdAt: meter.createdAt
        };
        res.status(200).json(out);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get latest reading by supplyNo or customerId
// @route   GET /api/meters/latest
// @access  Private
const getLatestReading = async (req, res) => {
    try {
        const { supplyNo, customerId } = req.query;
        const query = {};
        if (supplyNo) query.supplyNo = supplyNo;
        if (customerId) query.customerId = customerId;
        const latest = await Meter.find(query).sort({ readingDate: -1 }).limit(1).populate('customerId', 'fullName');
        if (!latest || latest.length === 0) return res.status(404).json({ message: 'No readings found' });
        const m = latest[0];
        res.status(200).json({
            _id: m._id,
            supplyNo: m.supplyNo,
            customerId: m.customerId,
            customerName: m.customerId?.fullName || '',
            prevReading: m.prevReading,
            currReading: m.currReading,
            unitsUsed: m.unitsUsed,
            readingDate: m.readingDate
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    getMeters,
    addMeter,
    updateMeter,
    deleteMeter,
    addReading,
    getMeter,
    getLatestReading
};
