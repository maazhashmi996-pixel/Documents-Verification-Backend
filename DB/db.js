const mongoose = require('mongoose');

const connectDB = async () => {
    // Pehle check karein ke variable mil raha hai ya nahi
    console.log("🔍 Env Check - MONGODB_URI:", process.env.MONGODB_URI ? "Found ✅" : "NOT FOUND ❌");

    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is missing from Environment Variables");
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected Successfully!");

        // One-time cleanup: students who were waiting for admin approval are now treated as approved
        const User = require('../models/User');
        const migrated = await User.updateMany(
            { role: 'student', isApproved: false, rejectionRemarks: null },
            { $set: { isApproved: true } }
        );
        if (migrated.modifiedCount) console.log(`✅ ${migrated.modifiedCount} pending student(s) marked as verified`);
    } catch (err) {
        console.error("🔥 Connection Error:", err.message);
        // Server ko crash na hone den taake aap logs dekh saken
        // process.exit(1); 
    }
};

module.exports = connectDB;