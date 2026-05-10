const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// 1. Load Environment Variables
dotenv.config();

// 2. Import Database Connection & Routes
const connectDB = require('./DB/db');
const authRoutes = require('./Routes/auth');
const adminRoutes = require('./Routes/adminRoutes');
const studentRoutes = require('./Routes/studentRoutes');
const universityRoutes = require('./Routes/universityRoutes');

// 3. Connect to MongoDB
connectDB();

const app = express();

// 4. Middlewares (Optimized for Production)
// Railway aur external domains ke liye CORS configuration
const allowedOrigins = [
    'http://localhost:3000',
    process.env.FRONTEND_URL // Railway environment variable se dynamic domain pick karega
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS (Qual Check Security)'));
        }
    },
    credentials: true
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
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

/** * FIXED: University Routes Mounting
 * Ensure /api/university/search-student is accessible
 */
app.use('/api/university', universityRoutes);

// 6. Base Route / Health Check
app.get('/', (req, res) => {
    res.json({
        status: "Success",
        message: 'Qual Check CRM API is running smoothly...',
        environment: process.env.NODE_ENV || 'development',
        version: "1.0.1"
    });
});

// 7. Global Error Handler
app.use((err, req, res, next) => {
    console.error("🔥 Global Error Log:", err.stack);

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, msg: "File size too large (Max 10MB)" });
    }

    res.status(err.status || 500).json({
        success: false,
        msg: err.message || "Internal Server Error",
        // Production mein stack trace hide rakha hai security ke liye
        error: process.env.NODE_ENV === 'development' ? err.stack : {}
    });
});

// 8. Start Server (Configured for Railway/Cloud)
const PORT = process.env.PORT || 5000;

// '0.0.0.0' is important for cloud deployment to accept external requests
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
        console.log(`📡 Health Check: http://localhost:${PORT}/`);
        console.log(`🛠️ University API Active: http://localhost:${PORT}/api/university/search-student`);
    }
});