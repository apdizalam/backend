const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // If no MONGO_URI provided, default to local shaba_water_billing DB
        const defaultUri = 'mongodb://127.0.0.1:27017/shaba_water_system';
        const mongoUri = process.env.MONGO_URI && process.env.MONGO_URI.length ? process.env.MONGO_URI : defaultUri;
        const conn = await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log(`MongoDB Connected: ${conn.connection.host} (db: ${conn.connection.name})`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
