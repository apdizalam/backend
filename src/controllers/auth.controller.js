const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { username, password, role, fullName, email, phoneNumber, phone, address, group } = req.body;

    try {
        const userExists = await User.findOne({ username });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Map incoming phoneNumber to the `phone` schema field if provided
        // For self-registered customers, leave supplyNo/meterNumber empty and mark as pending
        const formattedUsername = username.startsWith('@') ? username : `@${username.toLowerCase()}`;
        const actualPassword = password && password.trim() !== '' ? password : `shaba${(phoneNumber || phone || '').slice(-4)}`;
        const userPayload = {
            username: formattedUsername,
            password: actualPassword,
            visiblePassword: actualPassword,
            role,
            fullName,
            address,
            supplyNo: '',
            meterNumber: null,
            isActive: false,
            registrationStatus: role === 'customer' ? 'Pending Approval' : 'Active'
        };

        // include email if provided
        if (email) userPayload.email = email;

        // prefer `phoneNumber` from various frontends but store on `phone` field
        if (phoneNumber) userPayload.phone = phoneNumber;
        else if (phone) userPayload.phone = phone;

        // Normalize group labels to Somali backend enum values if provided
        if (group) {
            if (group === 'Households') userPayload.group = 'Guuri';
            else if (group === 'Commercial') userPayload.group = 'Ganacsi';
            else if (group === 'Government') userPayload.group = 'Dawladd';
            else userPayload.group = group;
        }

        // Do not accept meterNumber from mobile self-registration; meters are assigned by admin

        const user = await User.create(userPayload);

        if (user) {
            res.status(201).json({
                token: generateToken(user._id, user.role),
                user: {
                    _id: user.id,
                    username: user.username,
                    role: user.role,
                    fullName: user.fullName || '',
                }
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        // Anti-Gravity Universal Identity Fallback Bypass
        const usernameInput = req.body.username || req.body.email; // Fallback in case keys differ
        if (!usernameInput) {
            return res.status(400).json({ message: "Username or email is required" });
        }

        let user = await User.findOne({ username: usernameInput.toString().trim() });
        if (!user) {
            // Fallback to case-insensitive and prefix regex check to find user if registered as @abdi or similar
            const cleanUser = usernameInput.toString().trim();
            user = await User.findOne({ 
                username: { $regex: new RegExp(`^${cleanUser}$`, 'i') } 
            });
            if (!user) {
                const alternativeUsername = cleanUser.startsWith('@') ? cleanUser.slice(1) : `@${cleanUser}`;
                user = await User.findOne({
                    username: { $regex: new RegExp(`^${alternativeUsername}$`, 'i') }
                });
            }
        }

        if (!user) {
            return res.status(401).json({ message: "Login Failed: Invalid credentials" });
        }

        let isPasswordValid = false;
        // Check if the stored password string is an active bcrypt hash format ($2b$)
        if (user.password.startsWith('$2b$') || user.password.length === 60) {
            isPasswordValid = await bcrypt.compare(req.body.password.toString(), user.password);
        } else {
            // Direct matching fallback for plain-text entries like '3456' or '1122'
            isPasswordValid = (user.password === req.body.password.toString().trim());
        }

        if (!isPasswordValid) {
            return res.status(401).json({ message: "Login Failed: Invalid credentials" });
        }

        // Return response with role field explicitly
        res.json({
            token: generateToken(user._id, user.role),
            user: {
                _id: user._id,
                username: user.username,
                role: user.role, // Essential for frontend UI logic
                fullName: user.fullName || '',
            }
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    res.status(200).json(req.user);
};

module.exports = {
    registerUser,
    loginUser,
    getMe,
};
