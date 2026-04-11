const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        // File extension nikalna
        const fileExt = file.originalname.split('.').pop().toLowerCase();

        // Logical check: Agar Image ya PDF hai toh 'image' treat ho sakti hai, 
        // lekin Word/Excel ke liye Cloudinary ko 'raw' ya 'auto' chahiye hota hai.
        return {
            folder: 'student_docs',
            resource_type: 'auto', // Sabse important line: har tarah ki file support karne ke liye
            public_id: `${Date.now()}-${file.originalname.split('.')[0].replace(/\s+/g, '_')}`,
            // Word/Excel files ke liye 'format' parameter ko skip karna behtar hota hai
            // Cloudinary original extension khud handle kar leta hai 'auto' mode mein.
        };
    }
});

// Multer implementation with extra security
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB Limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('File type not supported! Please upload Image, PDF, Word, or Excel.'), false);
        }
    }
});

module.exports = upload;