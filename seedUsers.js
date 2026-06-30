const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./src/models/User.model');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/shaba_water_billing';

const seedUsers = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // We will generate a fresh salt and hash '123'
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('123', salt);

        // 1. Setup Admin
        const adminUser = await User.findOneAndUpdate(
            { username: 'admin' },
            { 
                $set: { 
                    password: hashedPassword, 
                    role: 'admin',
                    fullName: 'System Administrator'
                } 
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log('Admin user seeded/updated successfully');

        // 2. Setup Manager
        const managerUser = await User.findOneAndUpdate(
            { username: 'manager' },
            { 
                $set: { 
                    password: hashedPassword, 
                    role: 'manager',
                    fullName: 'System Manager'
                } 
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log('Manager user seeded/updated successfully');

        console.log('Done! Passwords for both users have been firmly set to "123".');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding users:', error);
        process.exit(1);
    }
};

seedUsers();
