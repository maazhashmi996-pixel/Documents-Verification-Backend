const User = require('../models/User');

/**
 * @route   POST /api/university/search-student
 * @desc    Passport number enter karke verified documents aur admin screenshots check karna
 * @access  Private (Only Approved Universities)
 */
exports.searchStudentByPassport = async (req, res) => {
    try {
        // 1. Role Check: Sirf university hi search kar sakti hai
        if (req.user.role !== 'university') {
            return res.status(403).json({ msg: "Access denied. Only Universities can access this search." });
        }

        // 2. Approval Check: Kya Admin ne is university ko approve kiya hai?
        const university = await User.findById(req.user.id);
        if (!university || !university.isApproved) {
            return res.status(403).json({
                msg: "Your university account is pending admin approval. You cannot search yet."
            });
        }

        const { passportNumber } = req.body;

        // 3. Input Validation
        if (!passportNumber) {
            return res.status(400).json({ msg: "Passport number is required for search." });
        }

        // 4. Student Search: Passport number aur role 'student' hona chahiye
        const student = await User.findOne({
            passportNumber: passportNumber,
            role: 'student'
        }).select('name email passportNumber documents');

        if (!student) {
            return res.status(404).json({ msg: "No student found with this Passport Number." });
        }

        // 5. Data Filtering: University ko sirf Verified documents dikhana
        // Hum filter kar rahay hain taake Pending ya Rejected docs university ko nazar na ayein
        const verifiedDocs = student.documents.filter(doc => doc.status === "Verified");

        // 6. Response: Agar verified docs nahi hain, to bhi student ki info aur empty array bhejain
        res.json({
            studentName: student.name,
            studentEmail: student.email,
            passportNumber: student.passportNumber,
            verifiedDocuments: verifiedDocs,
            message: verifiedDocs.length > 0
                ? "Verified documents found."
                : "No verified documents available for this student yet."
        });

    } catch (err) {
        console.error("University Search Error:", err.message);
        res.status(500).send("Server Error");
    }
};

/**
 * @route   GET /api/university/profile
 * @desc    University apna approval status aur profile dekh sakay
 */
exports.getUniversityProfile = async (req, res) => {
    try {
        const university = await User.findById(req.user.id).select('-password');
        res.json(university);
    } catch (err) {
        res.status(500).send("Server Error");
    }
};