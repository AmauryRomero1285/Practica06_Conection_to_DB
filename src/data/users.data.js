const userData = {};
import User from '../models/Users.js';

// Crear usuario
userData.insert = async (user) => {
    return await User.create(user);
};

// Buscar usuario por dirección email
userData.findByEmail = async (email) => {
    return await User.findOne({ email:email });
};

userData.findById = async (user_id) => {
    return await User.findOne({ user_id });
};

// Actualizar usuario
userData.update = async (sessionID, user) => {
    return await User.findOneAndUpdate({user_id: sessionID }, user);
};


// Mostrar usuarios registrados
userData.showUsers = async () => {
    return await User.find();
};

//Borrar usuario
userData.deleteUser=async(user_id)=>{
    return await User.deleteOne({user_id:user_id});
};

export default userData;
