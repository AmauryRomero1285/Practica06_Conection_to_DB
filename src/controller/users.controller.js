import { v4 as uuidv4 } from "uuid";
import moment from "moment-timezone";
import os from "os";
import userData from "../src/models/User.js";

const activeSessions = {}; // Variable para manejar sesiones activas

// Función para obtener la IP
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

// Función para calcular tiempo de inactividad
const calculateSessionInactivity = (lastAccessedAt) => {
  const now = moment();
  const lastAccessed = moment(lastAccessedAt);
  const duration = moment.duration(now.diff(lastAccessed));
  return `${duration.hours()}h ${duration.minutes()}m ${duration.seconds()}s`;
};

// Registrar usuario
const insert = async (req, res) => {
  const { email, nickname, macAddress } = req.body;
  if (!email || !nickname || !macAddress) {
    return res.status(400).json({ message: "Todos los campos son obligatorios" });
  }

  try {
    const sessionId = uuidv4();
    const user = await userData.insert({
      session_ID: sessionId,
      email,
      nickname,
      macAddress,
      ip: getLocalIP(),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    });

    res.status(200).json({ message: "Usuario registrado", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Iniciar sesión
const login = (req, res) => {
  const { email, nickname, macAddress } = req.body;
  if (!email || !nickname || !macAddress) {
    return res.status(400).json({ message: "Todos los campos son obligatorios" });
  }

  const sessionId = uuidv4();
  const now = new Date();

  const sessionData = {
    sessionId,
    email,
    nickname,
    macAddress,
    ip: getLocalIP(),
    createdAt: now,
    lastAccessedAt: now,
  };

  req.session.user = sessionData;
  activeSessions[sessionId] = sessionData;

  res.status(200).json({ message: "Inicio de sesión exitoso", sessionId });
};

// Cerrar sesión
const logout = (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || !activeSessions[sessionId]) {
    return res.status(404).json({ message: "Sesión no encontrada" });
  }

  delete activeSessions[sessionId];
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ message: "Error al cerrar sesión" });
    res.status(200).json({ message: "Sesión cerrada" });
  });
};

// Estado de sesión
const sessionStatus = (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || !activeSessions[sessionId]) {
    return res.status(404).json({ message: "No hay sesión activa" });
  }

  const session = activeSessions[sessionId];
  res.status(200).json({
    message: "Sesión activa",
    session,
    inactivityTime: calculateSessionInactivity(session.lastAccessedAt),
  });
};

// Listar sesiones activas
const listSessions = (req, res) => {
  const sessions = Object.values(activeSessions).map(session => ({
    sessionId: session.sessionId,
    email: session.email,
    nickname: session.nickname,
    macAddress: session.macAddress,
    ip: session.ip,
    createdAt: moment(session.createdAt).format("YYYY-MM-DD HH:mm:ss"),
    lastAccessedAt: moment(session.lastAccessedAt).format("YYYY-MM-DD HH:mm:ss"),
    inactivityTime: calculateSessionInactivity(session.lastAccessedAt),
  }));

  res.status(200).json({ message: "Sesiones activas", totalSessions: sessions.length, sessions });
};

export default { insert, login, logout, sessionStatus, listSessions };
