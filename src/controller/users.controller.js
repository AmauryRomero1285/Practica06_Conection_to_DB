import { v4 as uuidv4 } from "uuid";
import moment from "moment-timezone";
import os from "os";
import userData from "../data/users.data.js";
import sessionData from '../data/sessions.data.js';

// Función para obtener la IP local
const getLocalIP = () => {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
};

// Función para obtener la IP del cliente
const getClientIP = (req) => {
  let ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip;

  if (ip === "::1" || ip === "0.0.0.0") {
    ip = getLocalIP();
  }
  if (ip.includes("::ffff:")) {
    ip = ip.split("::ffff:")[1];
  }

  return ip;
};

// Función para calcular el tiempo de inactividad
const calculateSessionInactivity = (lastAccessedAt) => {
  const now = moment();
  const lastAccessed = moment(lastAccessedAt);
  const duration = moment.duration(now.diff(lastAccessed));
  let time= `${duration.hours()}h ${duration.minutes()}m ${duration.seconds()}s`;
  return time;
  if(`${duration.minutes()}m`>2){
   return dataSessions.update(SessionId).status="finished by inactivity";
  }
};

// Registrar usuario
const insert = async (req, res) => {
  const { email, nickname, macAddress } = req.body;

  if (!email || !nickname || !macAddress) {
    return res.status(400).json({ message: "Todos los campos son obligatorios" });
  }

  try {
    const existingUser = await userData.findByMacAddress(macAddress);
    if (existingUser) {
      return res.status(400).json({ message: "La dirección MAC ya está registrada." });
    }

    const sessionId = uuidv4();
    const user = await userData.insert({
      user_id: sessionId,
      email,
      nickname,
      macAddress,
      ip: getClientIP(req),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    });

    res.status(200).json({ message: "Usuario registrado", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



// Iniciar sesión
const login = async (req, res) => {
  const { email, nickname, user_id } = req.body;

  if (!email || !nickname || !user_id) {
    return res.status(400).json({ message: "Todos los campos son obligatorios" });
  }

  try {
    if (!userData.findById(user_id)) {
      return res.status(400).json({ message: "El Id de usuario no coincide." });
    }
    const SessionId = uuidv4();
    let session = await sessionData.findSession(SessionId);

    if (session) {
      if (session.status !== "active") {
        await sessionData.update(session_ID, { 
          status: "active",
          lastAccessedAt: new Date(),
        });

        req.session.user = session;
        return res.status(200).json({ message: "Sesión reactivada", sessionId: session_ID });
      } else {
        return res.status(400).json({ message: "La sesión ya está activa" });
      }
    }

    const now = new Date(); 
    session = {
      session_ID: SessionId,
      email,
      nickname,
      status: "active",
      createdAt: now,
      lastAccessedAt: now,
    };

    await sessionData.insert(session);
    req.session.user = session;

    res.status(200).json({ message: "Inicio de sesión exitoso", sessionId: SessionId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Cerrar sesión
const logout = async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ message: "ID de sesión es requerido" });
  }

  try {
    await sessionData.update(sessionId, { active: "finished for user" }); 
    req.session.destroy((err) => {
      if (err) throw err;
      res.status(200).json({ message: "Sesión cerrada" });
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Estado de sesión
const sessionStatus = async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ message: "ID de sesión es requerido" });
  }

  try {
    const session = await sessionData.getSessionById(sessionId); // Obtener la sesión de la base de datos
    if (!session) {
      return res.status(404).json({ message: "Sesión no encontrada" });
    }

    res.status(200).json({
      message: "Sesión activa",
      session,
      inactivityTime: calculateSessionInactivity(session.lastAccessedAt),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Listar sesiones activas
const listSessions = async (req, res) => {
  try {
    const sessions = await sessionData.showSessions(); 
    const formattedSessions = sessions.map((session) => ({
      sessionId: session.session_ID,
      email: session.email,
      nickname: session.nickname,
      macAddress: session.macAddress,
      ip: session.ip,
      createdAt: moment(session.createdAt).format("YYYY-MM-DD HH:mm:ss"),
      lastAccessedAt: moment(session.lastAccessedAt).format(
        "YYYY-MM-DD HH:mm:ss"
      ),
      inactivityTime: calculateSessionInactivity(session.lastAccessedAt),
    }));

    res.status(200).json({
      message: "Sesiones activas",
      totalSessions: formattedSessions.length,
      sessions: formattedSessions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export default { insert, login, logout, sessionStatus, listSessions };