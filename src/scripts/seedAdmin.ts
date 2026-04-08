import dotenv from 'dotenv';
import User from '../models/User';
import connectDB from '../config/database';

// Load environment variables
dotenv.config();

const seedAdmin = async () => {
  try {
    await connectDB();

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@microdo.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    // Check if admin already exists
    const adminExists = await User.findOne({ email: adminEmail });
    
    if (adminExists) {
      console.log(`Admin with email ${adminEmail} already exists.`);
      process.exit(0);
    }

    // Create admin
    const adminUser = await User.create({
      name: 'Super Admin',
      email: adminEmail,
      password: adminPassword,
      role: 'ADMIN',
      status: 'ACTIVE'
    });

    console.log(`Admin created successfully: ${adminUser.email}`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
