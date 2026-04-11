const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan'); // Request logging ke liye

// 1. Load Environment Variables
dotenv.config();

// 2. Import Database Connection & Routes
const connectDB = require('./DB/db');
const authRoutes = require('./Routes/auth');
const adminRoutes = require('./Routes/adminRoutes');
const studentRoutes = require('./Routes/studentRoutes');

// 3. Connect to MongoDB
connectDB();

const app = express();

// 4. Middlewares
app.use(cors());
app.use(morgan('dev')); // Console mein API requests track karne ke liye
app.use(express.json({ limit: '10mb' })); // File upload support ke liye size barha di
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Debugging logs (Development only)
if (process.env.NODE_ENV !== 'production') {
    console.log("🔍 MONGODB_URI:", process.env.MONGODB_URI ? "Found ✅" : "Missing ❌");
    console.log("🔍 CLOUDINARY:", process.env.CLOUDINARY_CLOUD_NAME ? "Configured ✅" : "Missing ❌");
}

// 5. Routes Mounting
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);

// 6. Base Route
app.get('/', (req, res) => {
    res.json({
        status: "Success",
        message: 'Qual Check CRM API is running...',
        version: "1.0.0"
    });
});

// 7. Global Error Handler (Ye buhat zaroori hai 500 errors pakarne ke liye)
app.use((err, req, res, next) => {
    console.error("🔥 Global Error Log:", err.stack);

    // Agar Multer ka error ho
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ msg: "File size too large (Max 10MB)" });
    }

    res.status(err.status || 500).json({
        success: false,
        msg: err.message || "Internal Server Error",
        // Development mein error detail dikhayega, production mein nahi
        error: process.env.NODE_ENV === 'development' ? err.stack : {}
    });
});

// 8. Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/`);
});