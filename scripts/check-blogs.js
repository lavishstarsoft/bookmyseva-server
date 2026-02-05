const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Blog = require('../models/Blog');

dotenv.config();

const checkBlogs = async () => {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to MongoDB');

        const count = await Blog.countDocuments();
        console.log(`Total Blogs: ${count}`);

        const published = await Blog.countDocuments({ status: 'published' });
        console.log(`Published Blogs: ${published}`);

        if (published === 0) {
            console.log('No published blogs found. Seeding required.');
        } else {
            const sample = await Blog.findOne({ status: 'published' });
            console.log('Sample Blog:', JSON.stringify(sample, null, 2));
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error checking blogs:', error);
        process.exit(1);
    }
};

checkBlogs();
