require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function main() {
    const name = String(process.env.ADMIN_NAME || '').trim();
    const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = String(process.env.ADMIN_PASSWORD || '');

    if (!name || !email || password.length < 12) {
        throw new Error('Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) before running this script.');
    }
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');

    await mongoose.connect(process.env.MONGODB_URI);
    const existingAdmin = await User.findOne({ role: 'admin' }).select('_id');
    if (existingAdmin) throw new Error('An administrator already exists. No changes were made.');
    const existingEmail = await User.findOne({ email }).select('_id');
    if (existingEmail) throw new Error('That email is already assigned to another account.');

    const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(12));
    await User.create({ name, email, password: passwordHash, role: 'admin', isApproved: true, isActive: true });
    console.log(`Administrator account created for ${email}.`);
}

main()
    .catch((err) => {
        console.error('Administrator setup failed:', err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    });
