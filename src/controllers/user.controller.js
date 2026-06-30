const User = require('../models/User.model');
const bcrypt = require('bcrypt');

// @desc Get all managers
// @route GET /api/users/managers
// @access Public (or protect if needed)
const getManagers = async (req, res) => {
    try {
        // Return only the fields required by the frontend
        const managers = await User.find({ role: 'manager' }).select('fullName username email phone visiblePassword _id');
        res.json(managers);
    } catch (error) {
        console.error('Get Managers Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Delete user by id (use modern Mongoose API)
const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedUser = await User.findByIdAndDelete(id);
        if (!deletedUser) {
            return res.status(404).json({ message: 'Manager-ka lama helin sxb' });
        }

        return res.status(200).json({ message: 'Manager-ka waa la tirtiray si guul ah sxb' });
    } catch (error) {
        console.error('Delete User Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.fullName = req.body.fullName || user.fullName;
            user.username = req.body.username || user.username;
            user.email = req.body.email || user.email;
            user.address = req.body.address || user.address;
            user.phone = req.body.phone || req.body.phoneNumber || user.phone;
            user.group = req.body.group || user.group;

            // Handle Avatar File Upload via Multer Memory Storage
            if (req.file) {
                // Convert buffer to base64 string
                const base64Image = req.file.buffer.toString('base64');
                const mimeType = req.file.mimetype;
                user.avatar = `data:${mimeType};base64,${base64Image}`;
            }

            if (req.body.newPassword) {
                // Verify old password
                if (!req.body.oldPassword) {
                    return res.status(400).json({ message: 'Old password is required to set a new password' });
                }
                const isMatch = await bcrypt.compare(req.body.oldPassword, user.password);
                if (!isMatch) {
                    return res.status(400).json({ message: 'Invalid old password' });
                }
                user.password = req.body.newPassword;
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                username: updatedUser.username,
                fullName: updatedUser.fullName,
                email: updatedUser.email,
                supplyNo: updatedUser.supplyNo, // Explicitly include supplyNo for frontend
                avatar: updatedUser.avatar,
                role: updatedUser.role,
                phone: updatedUser.phone,
                address: updatedUser.address,
                group: updatedUser.group
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getManagers, deleteUser, updateProfile };
