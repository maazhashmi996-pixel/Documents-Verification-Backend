const User = require('../models/User');

/**
 * @route   POST /api/university/search-student
 * @desc    Passport number enter karke verified documents aur admin screenshots check karna
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

        // 4. Student Search: Passport number aur role 'student' hona chahiye
        // Select mein verifySlip fields aur documents ka pura data uthaya hai
        const student = await User.findOne({
            passportNumber: passportNumber.trim(),
            role: 'student'
        }).select('name email passportNumber documents profileStatus remarks');

        if (!student) {
            return res.status(404).json({
                success: false,
                msg: "No student found with this Passport Number."
            });
        }

        // 5. Data Filtering: University ko Verified aur Received dono documents dikhana
        /**
         * UPDATED LOGIC:
         * Agar Admin ne document 'Received' kar liya hai lekin abhi 'Verified' nahi kiya, 
         * tab bhi University ko dikhna chahiye taake empty dashboard na aaye.
         */
        const visibleDocs = student.documents.filter(doc =>
            doc.status === "Verified" || doc.status === "Received"
        );

        /**
         * SLIP LINK CHECK:
         * Hum check kar rahe hain ke kya visible documents mein koi slip ya admin upload mojood hai.
         * Is mein Admin screenshot, verification image ya specific slip name sab check ho raha hai.
         */
        const slipExists = visibleDocs.some(doc =>
            doc.name === "verifySlip" ||
            doc.documentType === "verifySlip" ||
            doc.isAdminUploaded === true ||
            doc.verifySlip ||
            doc.adminScreenshot
        );

        // 6. Response Alignment: Dashboard isi format ko expect kar raha hai
        res.json({
            success: true,
            data: {
                fullName: student.name,
                email: student.email,
                passportNumber: student.passportNumber,
                // Ab yahan saare processed (Verified/Received) documents jayenge
                documents: visibleDocs,
                profileStatus: student.profileStatus || "Active",
                remarks: student.remarks || "Overall student profile is active in the central registry.",
                isAuthentic: true,
                // Frontend ke "Slip Linked" status ke liye flag
                isSlipLinked: slipExists
            },
            message: visibleDocs.length > 0
                ? "Processed documents found."
                : "No verified or received documents available for this student yet."
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

// Sab se important part: Functions ko object format mein export karna
module.exports = {
    searchStudentByPassport,
    getUniversityProfile
};