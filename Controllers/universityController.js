const User = require('../models/User');

/**
 * @route   POST /api/university/search-student
 * @desc    Passport number enter karke verified, received aur rejected documents check karna
 * @access  Private (Only Approved Universities)
 */
const searchStudentByPassport = async (req, res) => {
    try {
        // 1. Role Check: Sirf university hi search kar sakti hai
        if (req.user.role !== 'university') {
            return res.status(403).json({
                success: false,
                msg: "Access denied. Only Universities can access this search."
            });
        }

        // 2. Approval Check: Kya Admin ne is university ko approve kiya hai?
        const university = await User.findById(req.user.id);
        if (!university || !university.isApproved) {
            return res.status(403).json({
                success: false,
                msg: "Your university account is pending admin approval. You cannot search yet."
            });
        }

        // Frontend agar GET bhej raha hai toh query se lega, agar POST toh body se
        const passportNumber = req.body.passportNumber || req.query.passportNumber || req.body.searchQuery;

        // 3. Input Validation
        if (!passportNumber) {
            return res.status(400).json({
                success: false,
                msg: "Passport number is required for search."
            });
        }

        // 4. Student Search: Case-Insensitive Exact Match using Regex
        // Taake agar DB mein small 'abc365336' ho aur search capital 'ABC365336' ho, toh perfect match ho jaye
        const student = await User.findOne({
            passportNumber: { $regex: new RegExp("^" + passportNumber.trim() + "$", "i") },
            role: 'student'
        }).select('name email passportNumber documents profileStatus remarks');

        if (!student) {
            return res.status(404).json({
                success: false,
                msg: "No student found with this Passport Number."
            });
        }

        // 5. Data Handling (UPDATED LOGIC):
        // Saare documents bhej rahe hain (Verified, Received, aur Rejected).
        const allDocuments = student.documents;

        /**
         * SLIP LINK CHECK:
         * Hum check kar rahe hain ke kya documents mein koi slip ya admin upload mojood hai.
         */
        const slipExists = allDocuments.some(doc =>
            doc.name === "verifySlip" ||
            doc.documentType === "verifySlip" ||
            doc.isAdminUploaded === true ||
            doc.verifySlip ||
            doc.adminScreenshot ||
            doc.adminSlip
        );

        // 6. Response Alignment: Dashboard isi format ko expect kar raha hai
        res.json({
            success: true,
            data: {
                fullName: student.name,
                email: student.email,
                passportNumber: student.passportNumber, // Yeh DB wala original format hi bhejega
                documents: allDocuments,
                profileStatus: student.profileStatus || "Active",
                remarks: student.remarks || "Overall student profile is active in the central registry.",
                isAuthentic: student.profileStatus !== "Flagged", // Agar profile flagged nahi hai toh authentic hai
                isSlipLinked: slipExists
            },
            message: allDocuments.length > 0
                ? "Student records retrieved successfully."
                : "No documents found for this student."
        });

    } catch (err) {
        console.error("❌ University Search Error:", err.message);
        res.status(500).json({ success: false, msg: "Server Error" });
    }
};

/**
 * @route   GET /api/university/profile
 * @desc    University apna approval status aur profile dekh sakay
 */
const getUniversityProfile = async (req, res) => {
    try {
        const university = await User.findById(req.user.id).select('-password');
        if (!university) {
            return res.status(404).json({ success: false, msg: "University not found" });
        }
        res.json(university);
    } catch (err) {
        console.error("❌ Profile Fetch Error:", err.message);
        res.status(500).json({ success: false, msg: "Server Error" });
    }
};

// Functions ko object format mein export karna
module.exports = {
    searchStudentByPassport,
    getUniversityProfile
};