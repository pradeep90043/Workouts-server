// server/models/Workout.js
const mongoose = require('mongoose');

const setSchema = new mongoose.Schema({
  setNumber: { type: Number, required: true },
  reps: { type: Number, required: true },
  weight: { type: Number, default: 0 },
  rest: { type: Number, default: 60 },
  completed: { type: Boolean, default: false },
  notes: { type: String, default: '' }
}, { _id: false });

const statSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  sets: [setSchema],
  notes: { type: String, default: '' },
  rating: { type: Number, min: 0, max: 5 },
  duration: { type: Number, default: 0 }
}, { _id: false });

const workoutSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  userId: { type: String, required: true },
  date: { type: Date, required: true },
  name: { type: String, required: true },
  muscleGroup: { type: String, required: true },
  stats: [statSchema],
  completed: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Workout', workoutSchema);