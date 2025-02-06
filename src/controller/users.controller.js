import { v4 as uuidv4 } from "uuid";
import moment from "moment-timezone";
import os from "os";
import userData from "../data/users.data.js";
import sessionData from "../data/sessions.data.js";

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
const calculateSessionInactivity = async (sessionId, lastAccessedAt) => {
  const now = moment();
  const lastAccessed = moment(lastAccessedAt);
  const duration = moment.duration(now.diff(lastAccessed));
  const inactivityTime = `${duration.minutes()}m ${duration.seconds()}s`;

  if (duration.asMinutes() >= 2) {
    await sessionData.update(sessionId, { status: "inactive" });
    console.log(
      `La sesión ${sessionId} está inactiva. Debe reactivarse para continuar.`
    );
  }

  return inactivityTime;
};

// Registrar usuario
const insert = async (req, res) => {
  const { email, nickname, macAddress } = req.body;

  if (!email || !nickname || !macAddress) {
    return res
      .status(400)
      .json({ message: "Todos los campos son obligatorios" });
  }

  try {
    const existingUser = await userData.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        message: `Ya se encuentra un usuario registrado`,
      });
    }

    const userId = uuidv4();
    const user = await userData.insert({
      user_id: userId,
      email,
      nickname,
      macAddress,
      ip: getClientIP(req),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    });

    res.status(200).json({ message: "Usuario registrado exitosamente", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Iniciar sesión
const login = async (req, res) => {
  const { email, nickname, user_id } = req.body;

  if (!email || !nickname || !user_id) {
    return res
      .status(400)
      .json({ message: "Todos los campos son obligatorios" });
  }

  try {
    const user = await userData.findById(user_id);
    if (!user) {
      return res.status(400).json({ message: "El Id de usuario no coincide." });
    }

    const sessionId = uuidv4();
    let session = await sessionData.findSession(email);

    if (!session) {
      // Crear una nueva sesión si el email no tiene sesión
      const now = new Date();
      session = {
        session_ID: sessionId,
        email,
        nickname,
        status: "active",
        createdAt: now,
        lastAccessedAt: now,
      };
      await sessionData.insert(session);
      req.session.user = session;
      return res
        .status(200)
        .json({ message: "Nueva sesión creada", sessionId: sessionId });
    } else {
      // Actualizar el session_ID si la sesión ya existe
      await sessionData.update(session.session_ID, {
        session_ID: sessionId,
        status: "active",
        lastAccessedAt: new Date(),
      });
      req.session.user = { ...session, session_ID: sessionId };
      return res
        .status(200)
        .json({ message: "Sesión actualizada", sessionId: sessionId });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cerrar sesión
// Cerrar sesión
const logout = async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ message: "ID de sesión requerido" });
  }

  try {
    // Actualizar el session_ID a un valor único y marcar el estado como "finished by user"
    await sessionData.update(sessionId, {
      session_ID: `closed_${sessionId}`, // Valor único para evitar duplicados
      status: "finished by user",
    });

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Error al cerrar la sesión" });
      }
      res.status(200).json({ message: "Sesión cerrada exitosamente" });
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Estado de sesión
const sessionStatus = async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ message: "ID de sesión requerido" });
  }

  try {
    const session = await sessionData.findSession(sessionId);
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
