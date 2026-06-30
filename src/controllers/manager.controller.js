const User = require('../models/User.model');

const formatUsername = (username) => {
    const raw = (username || '').trim();
    if (!raw) return raw;
    return raw.startsWith('@') ? raw : `@${raw.toLowerCase()}`;
};

// @route   GET /api/managers
const listManagers = async (req, res) => {
    try {
        const managers = await User.find({ role: 'manager' })
            .select('fullName username email phone password visiblePassword _id createdAt')
            .sort({ createdAt: -1 });
        res.status(200).json(managers);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @route   POST /api/managers
const createManager = async (req, res) => {
    try {
        const { fullName, username, email, phone, phoneNumber, password } = req.body;
        const cleanUsername = formatUsername(username);
        const phoneValue = phone || phoneNumber;

        if (!fullName || !cleanUsername || !email || !phoneValue || !password) {
            return res.status(400).json({ success: false, message: 'All manager fields are required.' });
        }

        const exists = await User.findOne({ username: cleanUsername });
        if (exists) {
            return res.status(400).json({ success: false, message: 'Username already exists.' });
        }

        const manager = await User.create({
            fullName,
            username: cleanUsername,
            email,
            phone: phoneValue,
            password,
            visiblePassword: password,
            role: 'manager',
            registrationStatus: 'Active',
            isActive: true,
        });

        res.status(201).json({ success: true, manager });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @route   PUT /api/managers/:id
const updateManager = async (req, res) => {
    try {
        const { fullName, username, email, phone, phoneNumber, password } = req.body;
        const manager = await User.findOne({ _id: req.params.id, role: 'manager' });
        if (!manager) {
            return res.status(404).json({ success: false, message: 'Manager not found.' });
        }

        if (fullName) manager.fullName = fullName;
        if (email) manager.email = email;
        if (phone || phoneNumber) manager.phone = phone || phoneNumber;
        if (username) manager.username = formatUsername(username);
        if (password && password.trim()) {
            manager.password = password;
            manager.visiblePassword = password;
        }

        await manager.save();
        res.status(200).json({ success: true, manager });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @route   DELETE /api/managers/:id
const deleteManager = async (req, res) => {
    try {
        const deleted = await User.findOneAndDelete({ _id: req.params.id, role: 'manager' });
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Manager not found.' });
        }
        res.status(200).json({ success: true, message: 'Manager deleted successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { listManagers, createManager, updateManager, deleteManager };
