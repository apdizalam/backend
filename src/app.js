const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Route imports
const authRoutes = require('./routes/auth.routes');
const customerRoutes = require('./routes/customer.routes');
const meterRoutes = require('./routes/meter.routes');
const billRoutes = require('./routes/bill.routes');
const paymentRoutes = require('./routes/payment.routes');
const userRoutes = require('./routes/user.routes');
const managerRoutes = require('./routes/manager.routes');
const { getDashboardStats, getRecentTransactions } = require('./controllers/dashboard.controller');

const app = express();

// Middleware — allow Vite dev server (port 5173)
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan('dev'));

// Dashboard & transaction feeds (public fallbacks for admin UI)
app.get('/api/dashboard/stats', getDashboardStats);
app.get('/api/transactions', getRecentTransactions);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/managers', managerRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/meters', meterRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/billing', billRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.send('Shaba Water Billing API is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

module.exports = app;
