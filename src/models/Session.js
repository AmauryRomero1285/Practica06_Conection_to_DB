import {model,Schema} from "mongoose";
 const sessionSchema=new Schema({
    session_ID:{
        type:String,
        require:true,
        unique:true
    },
    nickname:String,
    email:String,
    status:{
        type:String,
        enum:["active","inactive","finished for user","finished by inactivity"],
        default:"inactive",
    }
 },
 {
   versionKey: false,
   timestamps: true,
 }
);
export default model('sessions', sessionSchema);
