const mongoose = require('mongoose');
const Bill = require('../src/models/Bill.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shaba_water_billing';

async function run() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', MONGO_URI);

  // WARNING: this will remove bills that don't match the new schema
  // Criteria: missing amountDue OR missing customerId
  const query = { $or: [ { amountDue: { $exists: false } }, { customerId: { $exists: false } } ] };

  const count = await Bill.countDocuments(query);
  console.log(`Found ${count} legacy/incompatible bills.`);
  if (count === 0) {
    console.log('Nothing to delete. Exiting.');
    process.exit(0);
  }

  const confirm = process.argv.includes('--yes');
  if (!confirm) {
    console.log('No --yes flag provided. Preview only. To delete run: node clear_old_bills.js --yes');
    process.exit(0);
  }

  const res = await Bill.deleteMany(query);
  console.log(`Deleted ${res.deletedCount} documents.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
