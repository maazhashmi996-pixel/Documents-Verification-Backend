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

/**
 * 🔍 EMERGENCY DEBUGGING BLOCK
 * Ye logs Railway par har haal mein nazar ayenge
 */
console.log("------------------------------------------");
console.log("🚀 STARTING SERVER DEBUG CHECK...");
console.log("📂 Current Directory:", __dirname);
console.log("🌐 NODE_ENV:", process.env.NODE_ENV);
console.log("🔑 MONGODB_URI:", process.env.MONGODB_URI ? "FOUND (Length: " + process.env.MONGODB_URI.length + ")" : "NOT FOUND ❌");
console.log("🖼️ CLOUDINARY_NAME:", process.env.CLOUDINARY_CLOUD_NAME ? "FOUND ✅" : "MISSING ❌");
console.log("📍 PORT VARIABLE:", process.env.PORT || "NOT SET (Using Default 5000)");
console.log("📡 FRONTEND_URL:", process.env.FRONTEND_URL || "NOT SET ❌");
console.log("------------------------------------------");

// 3. Connect to MongoDB
connectDB();

const app = express();

const allowedOrigins = [
    'http://localhost:3000',
    process.env.FRONTEND_URL
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log("❌ Blocked by CORS Origin:", origin);
            callback(new Error('Not allowed by CORS (Qual Check Security)'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
    credentials: true
}));

app.use(cors());

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 5. Routes Mounting
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/university', universityRoutes);

// 6. Base Route / Health Check
app.get('/', (req, res) => {
    res.json({
        status: "Success",
        message: 'Qual Check CRM API is running smoothly...',
        environment: process.env.NODE_ENV || 'development',
        db_status: process.env.MONGODB_URI ? "Configured" : "Missing",
        version: "1.0.3"
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
        error: process.env.NODE_ENV === 'development' ? err.stack : {}
    });
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ SERVER SUCCESS: Running on port ${PORT}`);
    console.log(`📡 Health Check Link: http://localhost:${PORT}/`);
});