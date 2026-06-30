const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'manager', 'customer'],
        default: 'manager'
    },
    // SHABA Customer fields (keeps `role` for app compatibility)
    fullName: {
        type: String,
        required: function () { return this.role === 'customer'; }
    },
    avatar: {
        type: String,
        default: null
    },
    phone: {
        type: String,
        required: function () { return this.role === 'customer'; },
        // Flexible Somali phone pattern: optional +252 or leading 0, prefixes like 61/62/63/65/67/68/69, then 7 digits
        match: [/^(\+252|0)?(61|62|63|65|67|68|69)\d{7}$/, 'Invalid phone number']
    },
    email: {
        type: String,
        required: false,
        trim: true,
        lowercase: true
    },
    address: {
        type: String,
        required: false
    },
    supplyNo: {
        type: String,
        required: false,
        default: ''
    },
    meterNumber: {
        type: String,
        required: false,
        default: null,
        sparse: true
    },
    isActive: {
        type: Boolean,
        default: false
    },
    registrationStatus: {
        type: String,
        enum: ['Pending Approval', 'Active', 'Rejected'],
        default: 'Pending Approval'
    },
    group: {
        type: String,
        enum: ['Guuri', 'Ganacsi', 'Dawladd', 'Households', 'Commercial', 'Government'],
        required: function () { return this.role === 'customer'; },
        default: 'Guuri',
        trim: true
    },
    registrationDate: {
        type: Date,
        default: Date.now
    }
    ,
    // store an admin-visible copy of the password for registration verification
    visiblePassword: {
        type: String,
        required: false
    }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    try {
        // Normalize empty meterNumber strings to null to avoid duplicate-index collisions
        if (this.meterNumber === '') {
            this.meterNumber = null;
        }

        // Ensure group defaults to 'Guuri' for customers if missing
        if (this.role === 'customer' && !this.group) {
            this.group = this.group || 'Guuri';
        }

        // Continue with password hashing if password was modified
        if (this.isModified('password')) {
            const salt = await bcrypt.genSalt(8);
            this.password = await bcrypt.hash(this.password, salt);
        }

        next();
    } catch (err) {
        next(err);
    }
});

// Match password
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Ensure Mongoose will create/adjust indexes according to this schema.
// Setting autoIndex true makes Mongoose build indexes automatically in development,
// but we'll also call syncIndexes() after compiling the model to force MongoDB
// to drop any legacy unique index (like meterNumber_1) that conflicts with the
// current schema (which uses sparse: true and default: null).
userSchema.set('autoIndex', true);

// Force MongoDB to drop the broken old constraint automatically without manual MongoShell intervention
userSchema.index({ meterNumber: 1 }, { unique: false, sparse: true });

const User = mongoose.model('User', userSchema);

// Attempt to synchronize indexes: this will create missing indexes and drop
// indexes that are no longer defined on the schema (for example a previous
// unique index on `meterNumber`). Run this once at startup; errors are logged.
User.syncIndexes()
    .then((res) => {
        console.log('User indexes synchronized:', res);
    })
    .catch((err) => {
        console.error('Error synchronizing User indexes:', err && err.message ? err.message : err);
    });

module.exports = User;
