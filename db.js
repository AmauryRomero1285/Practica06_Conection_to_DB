import mongoose from'mongoose';

mongoose.connect('mongodb+srv://derayruama1285:230190@awidb.6wy60.mongodb.net/AWI_DB?retryWrites=true&w=majority&appName=AWIDB')
.then((db)=>(console.log("Connected to MongoDB")))
.catch((error)=>console.log(error));

export default mongoose;