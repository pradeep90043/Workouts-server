const express = require('express');
const router = express.Router();
const Workout = require('../models/Workout');

// Default user ID to use when authentication is bypassed
const DEFAULT_USER_ID = 'demo-user';

/**
 * @route GET /api/workouts/summary
 * @desc Get workout summary grouped by date, muscle group, and exercise
 * @query startDate - Start date for filtering (ISO format)
 * @query endDate - End date for filtering (ISO format)
 */
router.get('/summary', async (req, res) => {
    try {
        const { startDate = '1970-01-01', endDate = new Date().toISOString() } = req.query;
        
        const summary = await Workout.aggregate([
            {
                $match: {
                    userId: DEFAULT_USER_ID,
                    date: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            { $unwind: '$exercises' },
            { $unwind: '$exercises.stats' },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$exercises.stats.date' } },
                        muscleGroup: '$exercises.muscleGroup',
                        exercise: '$exercises.name'
                    },
                    totalSets: { $sum: { $size: '$exercises.stats.sets' } },
                    totalVolume: {
                        $sum: {
                            $reduce: {
                                input: '$exercises.stats.sets',
                                initialValue: 0,
                                in: { $add: ['$$value', { $multiply: ['$$this.reps', '$$this.weight'] }] }
                            }
                        }
                    },
                    stats: { $push: '$exercises.stats' }
                }
            },
            {
                $group: {
                    _id: {
                        date: '$_id.date',
                        muscleGroup: '$_id.muscleGroup'
                    },
                    exercises: {
                        $push: {
                            name: '$_id.exercise',
                            totalSets: '$totalSets',
                            totalVolume: '$totalVolume',
                            stats: '$stats'
                        }
                    }
                }
            },
            {
                $group: {
                    _id: '$_id.date',
                    date: { $first: '$_id.date' },
                    muscleGroups: {
                        $push: {
                            name: '$_id.muscleGroup',
                            exercises: '$exercises'
                        }
                    },
                    totalExercises: { $sum: { $size: '$exercises' } },
                    totalVolume: { $sum: { $sum: '$exercises.totalVolume' } }
                }
            },
            { $sort: { _id: -1 } }
        ]);

        res.json({
            status: 'success',
            data: summary,
            meta: {
                startDate,
                endDate,
                totalWorkouts: summary.length
            }
        });
    } catch (error) {
        console.error('Error fetching workout summary:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch workout summary',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

/**
 * @route POST /api/workouts
 * @desc Add exercise details for a specific date
 * @body {
 *   date: string (ISO date),
 *   exercises: [{
 *     name: string,
 *     muscleGroup: string,
 *     sets: [{
 *       reps: number,
 *       weight: number,
 *       rest: number (optional, in seconds),
 *       completed: boolean (optional, default: true)
 *     }],
 *     notes: string (optional),
 *     rating: number (1-5, optional),
 *     duration: number (in seconds, optional)
 *   }],
 *   notes: string (optional)
 */
// Add a new workout with simplified data structure
router.post('/', async (req, res) => {
    try {
        const { exercises } = req.body;
        const currentDate = new Date();

        // Validate required fields
        if (!exercises || !Array.isArray(exercises) || exercises.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'At least one exercise is required'
            });
        }

        // Validate each exercise
        for (const [index, ex] of exercises.entries()) {
            if (!ex.name || !ex.muscleGroup || !Array.isArray(ex.sets) || ex.sets.length === 0) {
                return res.status(400).json({
                    status: 'error',
                    message: `Exercise at index ${index} is missing required fields (name, muscleGroup, or sets)`
                });
            }
            
            // Validate each set in the exercise
            for (const [setIndex, set] of ex.sets.entries()) {
                if (set.reps === undefined) {
                    return res.status(400).json({
                        status: 'error',
                        message: `Set ${setIndex + 1} in exercise '${ex.name}' is missing required 'reps' field`
                    });
                }
            }
        }

        // Create workout data with server-generated date
        const workoutData = {
            userId: DEFAULT_USER_ID,
            date: currentDate,
            exercises: exercises.map(ex => ({
                name: ex.name,
                muscleGroup: ex.muscleGroup.toLowerCase(),
                stats: [{
                    date: currentDate,
                    sets: ex.sets.map((set, index) => ({
                        setNumber: index + 1,
                        reps: set.reps,
                        weight: set.weight || 0,
                        rest: set.rest || 60,
                        completed: true,
                        notes: ''
                    })),
                    notes: ex.notes || '',
                    rating: ex.rating || 1,  // Default to 1 (minimum allowed)
                    duration: ex.duration || 0
                }]
            })),
            notes: `Workout on ${currentDate.toLocaleDateString()}`,
            completed: true
        };

        // Create and save the workout
        const workout = new Workout(workoutData);
        await workout.save();

        res.status(201).json({
            status: 'success',
            message: 'Workout added successfully',
            data: workout
        });
    } catch (error) {
        console.error('Error adding workout:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Error adding workout', 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router;
