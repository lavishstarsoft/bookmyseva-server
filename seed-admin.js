/**
 * Seed Admin User Script
 * Run with: node seed-admin.js
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

// User Schema (simplified for seeding)
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true, lowercase: true },
    password: String,
    role: { type: String, default: 'user' },
    isActive: { type: Boolean, default: true },
    loginHistory: []
}, { collection: 'admin_users' });

async function seedAdmin() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(DATABASE_URL);
        console.log('Connected to MongoDB');

        const User = mongoose.model('User', userSchema);

        // Check if admin exists
        const existingAdmin = await User.findOne({ email: 'admin@bookmyseva.com' });

        if (existingAdmin) {
            console.log('Admin already exists:');
            console.log('  Email: admin@bookmyseva.com');
            console.log('  Role:', existingAdmin.role);

            // Update password if needed
            const hashedPassword = await bcrypt.hash('Admin@123', 12);
            await User.updateOne(
                { email: 'admin@bookmyseva.com' },
                { $set: { password: hashedPassword, role: 'superadmin' } }
            );
            console.log('Password reset to: Admin@123');
        } else {
            // Create new admin
            const hashedPassword = await bcrypt.hash('Admin@123', 12);

            const admin = new User({
                name: 'Super Admin',
                email: 'admin@bookmyseva.com',
                password: hashedPassword,
                role: 'superadmin',
                isActive: true
            });

            await admin.save();
            console.log('Admin created successfully!');
            console.log('  Email: admin@bookmyseva.com');
            console.log('  Password: Admin@123');
            console.log('  Role: superadmin');
        }

        await mongoose.disconnect();
        console.log('\nDone!');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

seedAdmin();
