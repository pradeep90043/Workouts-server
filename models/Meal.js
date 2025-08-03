const mongoose = require("mongoose")


const mealSchema = new mongoose.Schema({
    userId: String,
    date: Date,
    mealType: String, // breakfast/lunch/snack/dinner
    items: [String],
    calories: Number,
    protein: Number,
    notes: String,
  }, { timestamps: true });

  module.exports = mongoose.model("meal",mealSchema)
  