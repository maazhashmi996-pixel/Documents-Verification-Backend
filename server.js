const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

// 1. Load Environment Variables with Debugging
const result = dotenv.config();

if (result.error) {
    console.error("❌ Dotenv Error: .env file nahi mili!", result.error);
} else {
    console.log("✅ .env file loaded successfully.");
}

// Ye line terminal mein check karke batayen kya aa raha hai
console.log("🔍 MONGODB_URI Value:", process.env.MONGODB_URI);

// 2. Import Database Connection & Routes
const connectDB = require('./DB/db');
const authRoutes = require('./Routes/auth');
const adminRoutes = require('./Routes/adminRoutes');
const studentRoutes = require('./Routes/studentRoutes');

// 3. Connect to MongoDB
connectDB();

const app = express();

// 4. Global Middlewares (Routes se PEHLE hona lazmi hai)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Routes Mounting
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);

// 6. Base Route
app.get('/', (req, res) => {
    res.send('Qual Check CRM API is running successfully...');
});

// 7. Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
});