const mongoose = require('mongoose');

const connectDB = async () => {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is missing from environment variables.');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully.');
    return mongoose.connection;
};

module.exports = connectDB;
