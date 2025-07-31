const mongoose = require('mongoose');

const detailSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    weight: { type: Number, required: true },
    bicep: { type: Number, required: true },
    chest: { type: Number, required: true },
    thigh: { type: Number, required: true },
    waist: { type: Number, required: true },
    belly: { type: Number, required: true },
    height: { type: Number, required: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    goal: { type: String, required: true },
    activityLevel: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },

}, { timestamps: true });

module.exports = mongoose.model('Detail', detailSchema);
