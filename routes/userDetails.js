const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Detail = require('../models/Details');

router.use(protect);

// Get current user details
router.get('/me', async (req, res) => {
    try {
        const userId = req.user.id;
        const details = await Detail.findOne({ userId });
        console.log('Fetched user details:', details, userId);

        if (!details) {
            return res.status(404).json({ message: 'User details not found' });
        }
        res.json(details);
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user details
router.put('/update', async (req, res) => {
    try {
        const { weight, bicep, chest, thigh, waist, belly, height, age, gender, goal, activityLevel } = req.body;
        const userId = req.user.id;
        // Basic validation
        if (!weight || !height || !age) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        const updateData = {
            weight,
            bicep,
            chest,
            thigh,
            waist,
            belly,
            height,
            age,
            gender,
            goal,
            activityLevel,
            updatedAt: new Date()
        };

        const options = { 
            new: true, 
            upsert: true, // Create if doesn't exist
            setDefaultsOnInsert: true 
        };

        const details = await Detail.findOneAndUpdate(
            { userId },
            updateData,
            options
        );

        res.json(details);
    } catch (error) {
        console.error('Error updating user details:', error);
        res.status(500).json({ 
            message: 'Error updating user details',
            error: error.message 
        });
    }
});

module.exports = router;