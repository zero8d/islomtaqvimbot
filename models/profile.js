const mongoose = require("mongoose")
const { Schema } = mongoose
const profileSchema = new Schema({
  user_id: { type: String, index: true },
  lang: String,
  region: String,
})

const ProfileModel = mongoose.model("profile", profileSchema)

module.exports = ProfileModel
