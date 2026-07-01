require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const allowedVercelHost = 'vercel.app';
    const allowedProjectPrefix = 'shaba-water-billing-system';
    const lowerOrigin = origin.toLowerCase();

    if (
      lowerOrigin === 'https://shaba-water-billing-system.vercel.app' ||
      (lowerOrigin.endsWith(`.${allowedVercelHost}`) && lowerOrigin.includes(allowedProjectPrefix))
    ) {
      return callback(null, true);
    }

    return callback(new Error('CORS policy: origin not allowed'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shaba_water_system';

mongoose.connect(MONGO_URI)
  .then(() => console.log('🚀 DB connected perfectly for Shaba Real-time Records!'))
  .catch((err) => console.error('❌ MongoDB initialization error:', err.message));

// --- REAL MONGOOSE SCHEMAS & MODELS ---

const managerSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'manager' },
  createdAt: { type: Date, default: Date.now },
});
const Manager = mongoose.models.Manager || mongoose.model('Manager', managerSchema);

const customerSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, default: '' },
  address: { type: String, default: '' },
  group: { type: String, default: 'Households' },
  username: { type: String },
  password: { type: String },
  visiblePassword: { type: String },
  avatar: { type: String, default: '' },
  registrationDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});
const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);

const meterSchema = new mongoose.Schema({
  supplyNo: { type: String, required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  previousReading: { type: Number, required: true },
  currentReading: { type: Number, required: true },
  units: { type: Number, required: true },
  readingDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});
const Meter = mongoose.models.Meter || mongoose.model('Meter', meterSchema);

const billSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  billNumber: { type: String, required: true },
  invoiceNo: { type: String },
  supplyNo: { type: String, default: '' },
  idNo: { type: Number },
  prevReading: { type: Number },
  currReading: { type: Number },
  prevDate: { type: Date },
  currDate: { type: Date },
  previousDate: { type: Date },
  currentDate: { type: Date },
  unitsUsed: { type: Number, default: 0 },
  period: { type: String, default: '' },
  billDate: { type: Date },
  amount: { type: Number, required: true },
  amountDue: { type: Number },
  status: { type: String, default: 'Pending' },
  dueDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
});
const Bill = mongoose.models.Bill || mongoose.model('Bill', billSchema);

const transactionSchema = new mongoose.Schema({
  reference: { type: String, required: true },
  type: { type: String, required: true },
  status: { type: String, default: 'Completed' },
  amount: { type: Number, default: 0 },
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  createdAt: { type: Date, default: Date.now },
});
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

// --- HELPERS ---

const formatUsername = (username) => {
  const raw = (username || '').trim();
  if (!raw) return raw;
  return raw.startsWith('@') ? raw : `@${raw.toLowerCase()}`;
};

const logTransaction = async (reference, type, amount = 0) => {
  try {
    await Transaction.create({
      reference: reference || `TX-${Math.floor(1000 + Math.random() * 9000)}`,
      type,
      amount,
      status: 'Completed',
      date: new Date().toISOString().split('T')[0],
    });
  } catch (err) {
    console.error('Transaction log error:', err.message);
  }
};

const normalizeCustomer = (doc) => {
  const c = doc.toObject ? doc.toObject() : doc;
  return {
    ...c,
    visiblePassword: c.visiblePassword || c.password || '',
    registrationDate: c.registrationDate || c.createdAt,
    avatar: c.avatar || '',
  };
};

const normalizeMeter = (doc) => {
  const m = doc.toObject ? doc.toObject() : doc;
  const customer = m.customer || null;
  return {
    _id: m._id,
    supplyNo: m.supplyNo,
    customerId: customer,
    customerName: customer?.fullName || '',
    prevReading: m.previousReading,
    currReading: m.currentReading,
    unitsUsed: m.units,
    readingDate: m.readingDate || m.createdAt,
    createdAt: m.createdAt,
  };
};

const normalizeBill = (doc) => {
  const b = doc.toObject ? doc.toObject() : doc;
  const customer = b.customer || null;
  return {
    _id: b._id,
    customerId: customer,
    customerName: customer?.fullName || '',
    customer: customer,
    supplyNo: b.supplyNo || '',
    idNo: b.idNo,
    billNumber: b.billNumber,
    invoiceNo: b.invoiceNo || b.billNumber || '',
    prevReading: b.prevReading,
    currReading: b.currReading,
    prevDate: b.prevDate || b.previousDate,
    currDate: b.currDate || b.currentDate,
    previousDate: b.previousDate || b.prevDate,
    currentDate: b.currentDate || b.currDate,
    unitsUsed: b.unitsUsed ?? 0,
    period: b.period || '',
    billDate: b.billDate,
    amount: b.amount,
    amountDue: b.amountDue ?? b.amount,
    status: b.status,
    dueDate: b.dueDate,
    createdAt: b.createdAt,
  };
};

const buildBillPayload = (body) => {
  const amount = body.amountDue ?? body.amount ?? 0;
  const prev = body.prevReading;
  const curr = body.currReading;
  let unitsUsed = body.unitsUsed ?? body.units;
  if (unitsUsed === undefined && prev != null && curr != null) {
    unitsUsed = Math.max(0, Number(curr) - Number(prev));
  }
  return {
    customer: body.customer || body.customerId,
    billNumber: body.billNumber || body.billId || `BILL-${Date.now()}`,
    supplyNo: body.supplyNo || '',
    idNo: body.idNo,
    prevReading: prev,
    currReading: curr,
    prevDate: body.prevDate || body.previousDate ? new Date(body.prevDate || body.previousDate) : undefined,
    currDate: body.currDate || body.currentDate ? new Date(body.currDate || body.currentDate) : undefined,
    previousDate: body.previousDate || body.prevDate ? new Date(body.previousDate || body.prevDate) : undefined,
    currentDate: body.currentDate || body.currDate ? new Date(body.currentDate || body.currDate) : undefined,
    unitsUsed: unitsUsed ?? 0,
    period: body.period || '',
    billDate: body.billDate ? new Date(body.billDate) : new Date(),
    amount: Number(amount),
    amountDue: Number(amount),
    status: body.status || 'Pending',
    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
  };
};

const buildMeterPayload = (body) => {
  const prev = Number(body.previousReading ?? body.prevReading ?? 0);
  const curr = Number(body.currentReading ?? body.currReading ?? 0);
  return {
    supplyNo: body.supplyNo,
    customer: body.customer || body.customerId,
    previousReading: prev,
    currentReading: curr,
    units: body.units ?? Math.max(0, curr - prev),
    readingDate: body.readingDate ? new Date(body.readingDate) : new Date(),
  };
};

// --- AUTH (login against Manager collection) ---

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const cleanUsername = username.toString().trim();
    const rawPassword = password.toString().trim();

    // 1. Check for Core Admin Account
    if (cleanUsername === 'admin' && rawPassword === 'admin') {
      return res.json({
        token: "admin-secure-token",
        user: { role: 'admin', username: 'admin', name: 'abdisalam mohamed', email: 'abdisalam@gmail.com' }
      });
    }

    // 2. Fallback to Manager Collection if not core admin
    let user = await Manager.findOne({
      $or: [{ username: cleanUsername }, { username: formatUsername(cleanUsername) }],
    });
    let userRole = user ? (user.role || 'manager') : null;

    // 3. Fallback to Customer Collection if not found in Manager
    if (!user) {
      user = await Customer.findOne({
        $or: [{ username: cleanUsername }, { username: formatUsername(cleanUsername) }],
      });
      if (user) {
        userRole = 'customer';
      }
    }

    if (!user) {
      return res.status(400).json({ message: "Login Failed: Invalid credentials" });
    }

    // Anti-Gravity Universal Password Matcher — supports bcrypt hashes AND plain text
    let isPasswordValid = false;
    if (user.password && (user.password.startsWith('$2b$') || user.password.length === 60)) {
      const bcrypt = require('bcrypt');
      isPasswordValid = await bcrypt.compare(rawPassword, user.password);
    } else {
      isPasswordValid = (user.password === rawPassword);
    }

    if (!isPasswordValid) {
      return res.status(400).json({ message: "Login Failed: Invalid credentials" });
    }

    let token = `shaba-${user._id}`;
    if (userRole === 'admin') {
      token = "admin-secure-token";
    } else if (userRole === 'manager') {
      token = "manager-secure-token";
    }

    res.json({
      token,
      user: {
        _id: user._id,
        role: userRole,
        username: user.username,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/health', async (req, res) => {
  res.status(200).json({ message: "Service is running smoothly." });
} );

// --- AUTH/ME (return current user profile from token) ---

app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.substring(7);

    // Admin token
    if (token === 'admin-secure-token') {
      return res.json({ role: 'admin', username: 'admin', fullName: 'System Administrator', email: 'admin@shaaba.com' });
    }

    // Manager token
    if (token === 'manager-secure-token') {
      const manager = await Manager.findOne({ role: 'manager' });
      if (manager) {
        return res.json({ role: 'manager', username: manager.username, fullName: manager.fullName, email: manager.email, phone: manager.phone });
      }
    }

    // Customer token (shaba-<id>)
    if (token.startsWith('shaba-')) {
      const customerId = token.substring(6);
      const customer = await Customer.findById(customerId);
      if (customer) {
        const meter = await Meter.findOne({ customer: customer._id });
        return res.json({
          _id: customer._id,
          role: 'customer',
          fullName: customer.fullName,
          username: customer.username,
          email: customer.email,
          phone: customer.phone,
          address: customer.address || '',
          group: customer.group || 'Guuri',
          avatar: customer.avatar || '',
          supplyNo: meter ? meter.supplyNo : '',
          supplyNumber: meter ? meter.supplyNo : ''
        });
      }
    }

    return res.status(404).json({ message: 'User not found' });
  } catch (err) {
    console.error('Auth/me error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// --- DASHBOARD ---

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const customers = await Customer.countDocuments();
    const billsPaid = await Bill.countDocuments({ status: { $in: ['Paid', 'PAID'] } });
    const overdue = await Bill.countDocuments({ status: { $in: ['Overdue', 'OVERDUE'] } });
    const paidBills = await Bill.find({ status: { $in: ['Paid', 'PAID'] } });
    const revenue = paidBills.reduce((sum, b) => sum + (b.amountDue ?? b.amount ?? 0), 0);
    res.status(200).json({ customers, billsPaid, overdue, revenue });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- MANAGERS ---

app.get('/api/managers', async (req, res) => {
  try {
    const managers = await Manager.find().sort({ createdAt: -1 });
    res.status(200).json(managers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/managers', async (req, res) => {
  try {
    const data = { ...req.body, username: formatUsername(req.body.username) };
    if (data.phoneNumber && !data.phone) data.phone = data.phoneNumber;
    const newManager = new Manager(data);
    await newManager.save();
    await logTransaction(`TX-${Math.floor(1000 + Math.random() * 9000)}`, `Manager Registered: ${newManager.fullName}`, 0);
    res.status(201).json({ success: true, manager: newManager });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/managers/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.username) data.username = formatUsername(data.username);
    if (data.phoneNumber) data.phone = data.phoneNumber;
    const manager = await Manager.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!manager) return res.status(404).json({ success: false, message: 'Manager not found' });
    res.status(200).json({ success: true, manager });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/managers/:id', async (req, res) => {
  try {
    const manager = await Manager.findByIdAndDelete(req.params.id);
    if (!manager) return res.status(404).json({ success: false, message: 'Manager not found' });
    res.status(200).json({ success: true, message: 'Manager deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- CUSTOMERS ---

app.get('/api/customers', async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.status(200).json(customers.map(normalizeCustomer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const payload = {
      ...req.body,
      visiblePassword: req.body.password || req.body.visiblePassword,
    };
    const newCustomer = new Customer(payload);
    await newCustomer.save();
    await logTransaction(`TX-${Math.floor(1000 + Math.random() * 9000)}`, `Customer Registered: ${newCustomer.fullName}`, 0);
    res.status(201).json({ success: true, customer: normalizeCustomer(newCustomer) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.password) payload.visiblePassword = payload.password;
    const customer = await Customer.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.status(200).json({ success: true, customer: normalizeCustomer(customer) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.status(200).json({ success: true, message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/customers/update-password', async (req, res) => {
  try {
    const { customerId, oldPassword, newPassword } = req.body;
    const account = await Customer.findById(customerId);
    if (!account) {
      return res.status(404).json({ message: "Customer not found" });
    }
    const checkValid = (account.password === oldPassword.toString().trim());
    if (!checkValid) {
      return res.status(400).json({ message: "Current password input is incorrect" });
    }
    account.password = newPassword.toString().trim();
    account.visiblePassword = newPassword.toString().trim();
    await account.save();
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/customer/profile/update', async (req, res) => {
  try {
    const { name, fullName, email, username, oldPassword, newPassword, avatar, address, phone } = req.body;
    let customerId;

    // 1. Try to get ID from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token.startsWith('shaba-')) {
        customerId = token.split('-')[1];
      }
    }

    let customer;
    if (customerId) {
      customer = await Customer.findById(customerId);
    }

    // 2. Fallback to finding by email or username if ID not found or customer not found
    if (!customer) {
      customer = await Customer.findOne({
        $or: [
          { email: email || '___nonexistent___' },
          { username: username || '___nonexistent___' },
          { username: formatUsername(username) || '___nonexistent___' }
        ]
      });
    }

    if (!customer) {
      return res.status(404).json({ success: false, message: "Macaamiilka la raadinayo lama helin" });
    }

    // 3. Password verify check (if newPassword is provided)
    if (newPassword) {
      if (!oldPassword) {
        return res.status(400).json({ success: false, message: "Waa qasab inaad geliso password-kaagii hore si aad u beddesho!" });
      }
      
      let isPasswordValid = false;
      const rawPassword = oldPassword.toString().trim();
      if (customer.password && (customer.password.startsWith('$2b$') || customer.password.length === 60)) {
        const bcrypt = require('bcrypt');
        isPasswordValid = await bcrypt.compare(rawPassword, customer.password);
      } else {
        isPasswordValid = (customer.password === rawPassword);
      }

      if (!isPasswordValid) {
        return res.status(400).json({ success: false, message: "Password-kii hore waa khaldan yahay" });
      }
      customer.password = newPassword.toString().trim();
      customer.visiblePassword = newPassword.toString().trim();
    }

    // 4. Update other fields
    const resolvedName = fullName || name;
    if (resolvedName) customer.fullName = resolvedName;
    if (email) customer.email = email;
    if (username) customer.username = formatUsername(username);
    if (avatar) customer.avatar = avatar;
    if (address !== undefined) customer.address = address;
    if (phone !== undefined) customer.phone = phone;

    await customer.save();

    // Find supply number if any
    const meter = await Meter.findOne({ customer: customer._id });
    const supplyNumber = meter ? meter.supplyNo : '';

    res.json({
      success: true,
      user: {
        _id: customer._id,
        role: 'customer',
        username: customer.username,
        name: customer.fullName,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address || '',
        avatar: customer.avatar || '',
        supplyNumber: supplyNumber,
        supplyNo: supplyNumber
      }
    });
  } catch (err) {
    console.error("Profile update error:", err.message);
    res.status(500).json({ success: false, message: err.message || "Cilad ayaa dhacday" });
  }
});

// --- METERS ---

app.get('/api/meters', async (req, res) => {
  try {
    const meters = await Meter.find().populate('customer').sort({ createdAt: -1 });
    res.status(200).json(meters.map(normalizeMeter));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/meters/latest', async (req, res) => {
  try {
    const { supplyNo, customerId } = req.query;
    const query = {};
    if (supplyNo) query.supplyNo = supplyNo;
    if (customerId) query.customer = customerId;
    const meter = await Meter.findOne(query).populate('customer').sort({ createdAt: -1 });
    if (!meter) return res.status(200).json(null);
    res.status(200).json(normalizeMeter(meter));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/meters', async (req, res) => {
  try {
    const newMeter = new Meter(buildMeterPayload(req.body));
    await newMeter.save();
    const populated = await Meter.findById(newMeter._id).populate('customer');
    await logTransaction(`TX-${Math.floor(1000 + Math.random() * 9000)}`, `Meter Reading: ${newMeter.supplyNo}`, 0);
    res.status(201).json({ success: true, meter: normalizeMeter(populated) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/meters/:id', async (req, res) => {
  try {
    const meter = await Meter.findByIdAndUpdate(req.params.id, buildMeterPayload(req.body), { new: true }).populate('customer');
    if (!meter) return res.status(404).json({ success: false, message: 'Meter not found' });
    res.status(200).json({ success: true, meter: normalizeMeter(meter) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/meters/:id', async (req, res) => {
  try {
    const meter = await Meter.findByIdAndDelete(req.params.id);
    if (!meter) return res.status(404).json({ success: false, message: 'Meter not found' });
    res.status(200).json({ success: true, message: 'Meter deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- BILLING ---

const listBills = async (req, res) => {
  try {
    const filter = {};
    if (req.query.customerId) {
      filter.customer = req.query.customerId;
    }
    const bills = await Bill.find(filter).populate('customer').sort({ createdAt: -1 });
    res.status(200).json(bills.map(normalizeBill));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createBill = async (req, res) => {
  try {
    const payload = buildBillPayload(req.body);

    const lastBillItem = await Bill.findOne().sort({ invoiceNo: -1 });
    let assignedSequence = 1;
    if (lastBillItem && lastBillItem.invoiceNo) {
      const lastNum = parseInt(lastBillItem.invoiceNo.replace('BILL-', ''), 10);
      if (!isNaN(lastNum)) {
        assignedSequence = lastNum + 1;
      }
    }
    payload.invoiceNo = assignedSequence.toString();
    payload.idNo = assignedSequence;
    payload.billNumber = `BILL-${assignedSequence}`;

    const newBill = new Bill(payload);
    await newBill.save();
    const populated = await Bill.findById(newBill._id).populate('customer');
    await logTransaction(newBill.billNumber, 'Billing Bill Generated', newBill.amount);
    res.status(201).json({ success: true, bill: normalizeBill(populated) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

app.get('/api/bills/next-id', async (req, res) => {
  try {
    const lastBillItem = await Bill.findOne().sort({ invoiceNo: -1 });
    let assignedSequence = 1;
    if (lastBillItem && lastBillItem.invoiceNo) {
      const lastNum = parseInt(lastBillItem.invoiceNo.replace('BILL-', ''), 10);
      if (!isNaN(lastNum)) {
        assignedSequence = lastNum + 1;
      }
    }
    res.status(200).json({ nextId: assignedSequence.toString() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/admin/profile', async (req, res) => {
  try {
    const { name, email } = req.body;
    const admin = await Manager.findOne({ role: 'admin' });
    if (admin) {
      admin.fullName = name;
      admin.email = email;
      await admin.save();
    }
    const custAdmin = await Customer.findOne({ username: 'admin' });
    if (custAdmin) {
      custAdmin.fullName = name;
      custAdmin.email = email;
      await custAdmin.save();
    }
    res.status(200).json({ name, email, role: 'admin', username: 'admin' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/billing', listBills);
app.get('/api/bills', listBills);
app.post('/api/billing', createBill);
app.post('/api/bills', createBill);

const updateBill = async (req, res) => {
  try {
    const bill = await Bill.findByIdAndUpdate(req.params.id, buildBillPayload(req.body), { new: true }).populate('customer');
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
    res.status(200).json({ success: true, bill: normalizeBill(bill) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

app.put('/api/billing/:id', updateBill);
app.put('/api/bills/:id', updateBill);

app.delete('/api/billing/:id', async (req, res) => {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
    res.status(200).json({ success: true, message: 'Bill deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/bills/:id', async (req, res) => {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
    res.status(200).json({ success: true, message: 'Bill deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ createdAt: -1 }).limit(10);
    res.status(200).json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments/pay', async (req, res) => {
  try {
    const { customerId, supplyNo, amount, gateway, phoneNumber } = req.body;
    
    // Find latest unpaid bill for this supplyNo or customerId
    const bill = await Bill.findOne({
      $or: [{ supplyNo }, { customer: customerId }],
      status: { $in: ['Pending', 'Overdue'] }
    }).sort({ createdAt: -1 });

    // Update the Bill to 'Paid'
    if (bill) {
      bill.status = 'Paid';
      await bill.save();
    }

    const transactionId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create Payment record
    const Payment = mongoose.models.Payment || mongoose.model('Payment', new mongoose.Schema({
      bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
      customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
      amount: Number,
      paymentMethod: String,
      transactionId: String,
      status: String,
      paidAt: Date
    }));

    const payment = await Payment.create({
      bill: bill ? bill._id : null,
      customer: customerId,
      amount: Number(amount || 0),
      paymentMethod: gateway || 'MOBILE_APP',
      transactionId: transactionId,
      status: 'SUCCESS',
      paidAt: new Date()
    });

    // Log the transaction in backend's logs
    await logTransaction(transactionId, `Bill Payment via ${gateway || 'MOBILE_APP'}`, Number(amount || 0));

    res.status(200).json({ success: true, payment });
  } catch (error) {
    console.error('Payment pay error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Seed default admin manager
const seedAdmin = async () => {
  try {
    const admin = await Manager.findOne({ username: 'admin' });
    if (!admin) {
      await Manager.create({
        fullName: 'System Administrator',
        username: 'admin',
        email: 'admin@shaaba.com',
        phone: '+252000000000',
        password: '123',
        role: 'admin',
      });
      console.log('Seeded admin user (username: admin, password: 123)');
    }
  } catch (err) {
    console.error('Seed error:', err.message);
  }
};

mongoose.connection.once('open', () => {
  seedAdmin();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`⚡ Shaba Core database engine active on port ${PORT}`);
});
