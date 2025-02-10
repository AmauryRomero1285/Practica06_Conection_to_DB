const sessionData = {};
import Session from "../models/Session.js";

//crear sesión
sessionData.insert = async (session) => {
  return await Session.create(session);
};
//Actualizar sesión
sessionData.update = async (sessionID, session) => {
  return await Session.findOneAndUpdate({ session_ID: sessionID }, session);
};

//Mostrar las sesiones
sessionData.showSessions=async()=>{
    return await Session.find();
};

//Buscar por sesión
sessionData.findSession=async(session_ID)=>{
    return await Session.findOne({session_ID: session_ID});
};


//Actualizar sesión
sessionData.update = async (session_ID, session) => {
  return await Session.findOneAndUpdate({ session_ID: session_ID }, session);
};

//Eliminar Sesiones
sessionData.delete = async () => {
  return await Session.deleteMany();
};

export default sessionData;
