const userData={};
import User from '../src/models/User.js';

//Crear usuario
userData.insert=async(user)=>{
    return await User.create(user);
};
//Actualizar usuario
userData.update=async(sessionID,user)=>{
    return await User.findOneAndUpdate({session_ID:sessionID},user);
};

//Mostrar usuarios registrados
userData.showUsers=async()=>{
    return await User.find();
};

export default userData;