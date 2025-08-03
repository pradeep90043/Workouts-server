const express = require("express")
const router = express.Router()
const Meal = require("../models/Meal")
const {protect} = require("../middleware/auth")

router.use(protect)

router.get("/", async (req,res)=>{
    console.log("Meal request - User ID:", req.user.id, "Username:", req.user.username);
    try {
        const userId = req.user.id;
        const meal = await Meal.find({userId})
        console.log("Fetched meal:", meal);
        res.json(meal)
    } catch (error) {
        console.error("Error fetching meal:", error)
        res.status(500).json({message: "Server error"})
    }
})

router.put("/update", async (req,res)=>{
    try {
        const {date,mealType,items,calories,protein,notes} = req.body
        const userId = req.user.id
        const updateData = {
            date,
            mealType,
            items,
            calories,
            protein,
            notes,
            updatedAt: new Date()
        }
        const options = { 
            new: true, 
            upsert: true, // Create if doesn't exist
            setDefaultsOnInsert: true 
        }
        const meal = await Meal.findOneAndUpdate(
            {userId,date,mealType},
            updateData,
            options
        )
        res.json(meal)
    } catch (error) {
        console.error("Error updating meal:", error)
        res.status(500).json({message: "Server error"})
    }
})

router.delete("/delete", async (req,res)=>{
    try {
        const {date,mealType} = req.body
        const userId = req.user.id
        const meal = await Meal.findOneAndDelete({userId,date,mealType})
        res.json(meal)
    } catch (error) {
        console.error("Error deleting meal:", error)
        res.status(500).json({message: "Server error"})
    }
})
module.exports = router
