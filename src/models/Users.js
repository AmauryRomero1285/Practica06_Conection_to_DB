import { model, Schema } from "mongoose";
const userSchema = new Schema(
  {
    user_id: {
      unique: true,
      require: true,
      type: String,
    },
    email: String,
    nickname: String,
    macAddress:String,
    ip:String,
  },
  {
    versionKey: false,
    timestamps: true,
  }
);
export default model('users', userSchema);
