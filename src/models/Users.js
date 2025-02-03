import { model, Schema } from "mongoose";
const userSchema = new Schema(
  {
    session_ID: {
      unique: true,
      require: true,
      type: String,
    },
    email: String,
    nickname: String,
    macAddress:{
      unique: true,
      type: String,
    },
    ip:{
      unique: true,
      type: String,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);
export default model('users', userSchema);
