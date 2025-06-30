const mongoose = require('mongoose');

const exerciseStatsSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    sets: [{
        setNumber: {
            type: Number,
            required: true,
            min: 1
        },
        reps: {
            type: Number,
            required: true,
            min: 1
        },
        weight: {
            type: Number,
            required: true,
            min: 0
        },
        rest: {
            type: Number,
            default: 60, // seconds
            min: 0
        },
        completed: {
            type: Boolean,
            default: false
        }
    }],
    notes: {
        type: String,
        trim: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    duration: Number // in seconds
}, { _id: false });

const exerciseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    muscleGroup: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        enum: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'core', 'cardio', 'other']
    },
    stats: [exerciseStatsSchema]
}, { _id: false });

const workoutSessionSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    exercises: [exerciseSchema],
    notes: {
        type: String,
        trim: true
    },
    duration: Number, // Total workout duration in seconds
    completed: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes for faster queries
workoutSessionSchema.index({ userId: 1, date: -1 });
workoutSessionSchema.index({ 'exercises.muscleGroup': 1, 'exercises.name': 1 });

// Add a method to add exercise to a workout
workoutSessionSchema.methods.addExercise = function(exerciseData) {
    this.exercises.push(exerciseData);
    return this.save();
};

// Add a method to add stats to an exercise
workoutSessionSchema.methods.addExerciseStats = function(exerciseName, statsData) {
    const exercise = this.exercises.find(ex => ex.name === exerciseName);
    if (exercise) {
        exercise.stats.push(statsData);
        return this.save();
    }
    throw new Error('Exercise not found in this workout');
};

// Static method to get workout summary by date range
workoutSessionSchema.statics.getWorkoutSummary = async function(userId, startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                userId,
                date: { $gte: new Date(startDate), $lte: new Date(endDate) }
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
};

const Workout = mongoose.model('Workout', workoutSessionSchema);

module.exports = Workout;
