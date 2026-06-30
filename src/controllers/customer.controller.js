const User = require('../models/User.model');
const Meter = require('../models/Meter.model');

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private/Admin/Cashier
const getCustomers = async (req, res) => {
    try {
        const customers = await User.find({ role: 'customer' });
        res.status(200).json(customers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a customer (via User creation)
// @route   POST /api/customers
// @access  Private/Admin/Cashier
const createCustomer = async (req, res) => {
    try {
        // accept either `phone` or `phoneNumber` from different clients
        const { fullName, phone: phoneRaw, phoneNumber, email, address, group, username, password } = req.body;
        const phone = phoneRaw || phoneNumber;

        // basic required fields
        if (!group) {
            return res.status(400).json({ message: 'Group is required for customers' });
        }

        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({
            username,
            password,
            role: 'customer',
            fullName,
            phone,
            email,
            address,
            group
        });

        // also store visible password for admin reference (only if provided)
        if (password) {
            user.visiblePassword = password;
            await user.save();
        }

        const userObj = user.toObject();
        delete userObj.password;
        res.status(201).json(userObj);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private/Admin
const updateCustomer = async (req, res) => {
    try {
        const updates = { ...req.body };
        // if password is being updated, keep a visible copy for admin reference
        if (updates.password) updates.visiblePassword = updates.password;
        const customer = await User.findByIdAndUpdate(req.params.id, updates, {
            new: true,
        });
        if (!customer || customer.role !== 'customer') {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.status(200).json(customer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete customer (or deactivate)
// @route   DELETE /api/customers/:id
// @access  Private/Admin
const deleteCustomer = async (req, res) => {
    try {
        const customer = await User.findById(req.params.id);
        if (!customer || customer.role !== 'customer') {
            return res.status(404).json({ message: 'Customer not found' });
        }
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Customer deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer
};
