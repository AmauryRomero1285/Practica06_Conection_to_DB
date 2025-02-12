import { v4 as uuidv4 } from "uuid";
import moment from "moment-timezone";
import os from "os";
import userData from "../data/users.data.js";
import sessionData from "../data/sessions.data.js";
import crypto from "crypto";
import fs from 'fs';

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
const sessionTimers = {}; 
const startInactivityTimer = (sessionId) => {
  // Si ya hay un temporizador, lo reiniciamos
  if (sessionTimers[sessionId]) {
    clearTimeout(sessionTimers[sessionId]);
  }

  sessionTimers[sessionId] = setTimeout(async () => {
    try {
      await sessionData.update(sessionId, { status: "inactive" });
      console.log(`Sesión ${sessionId} cerrada por inactividad.`);
    } catch (error) {
      console.error(`Error al actualizar la sesión ${sessionId}:`, error);
    }
  }, 4 * 60 * 1000); 
};

const calculateInactivity = (session) => {
  const lastAccess = new Date(session.lastAccessedAt);
  if (isNaN(lastAccess)) {
    console.error("Fecha de acceso inválida:", session.lastAccessedAt);
    return { inactivityTime: null, isInactive: false }; 
  }

  const now = new Date();
  const inactivityTime = Math.floor((now - lastAccess) / 1000); 
  const isInactive = inactivityTime >= 4 * 60; 

  return { inactivityTime, isInactive };
};


//Funcion para generar un id
const generateID = () => { 
  return (
    Math.floor(10000 + Math.random() * 90000) + Date.now().toString().slice(-5)
  );
};

// Solo generar claves si no existen
if (!fs.existsSync("private.pem") || !fs.existsSync("public.pem")) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 512,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  fs.writeFileSync("public.pem", publicKey);
  fs.writeFileSync("private.pem", privateKey);
}

// Cargar claves guardadas
const publicKey = fs.readFileSync("public.pem", "utf8");
const privateKey = fs.readFileSync("private.pem", "utf8");

// Función para cifrar datos
const encryptData = (data) => {
  return crypto.publicEncrypt(publicKey, Buffer.from(data)).toString("base64");
};

// Función para descifrar datos
const decryptData = (encryptedData) => {
  return crypto
    .privateDecrypt(privateKey, Buffer.from(encryptedData, "base64"))
    .toString();
};

// Registrar usuario
const insert = async (req, res) => {
  const { email, nickname, password } = req.body;

  if (!email || !nickname || !password) {
    return res
      .status(400)
      .json({ message: "Todos los campos son obligatorios" });
  }

  try {
    const existingUser = await userData.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        message: `Ya existe un usuario registrado con el correo: ${email}`,
      });
    }

    const userId = generateID();
    const encryptedPassword = encryptData(password);
    const user = await userData.insert({
      user_id: userId,
      email,
      nickname,
      password:encryptedPassword,
      ip: getClientIP(req),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    });
    res.status(200).json({ message: "Usuario registrado exitosamente", user });
    console.log("Contraseña del usuario: ", password);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Iniciar sesión
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Todos los campos son obligatorios" });
  }

  try {
    const user = await userData.findByEmail(email);
    if (!user) {
      return res.status(400).json({ message: "El usuario no está registrado." });
    }

    const decryptedPass = decryptData(user.password);
    if (decryptedPass !== password) {
      return res.status(400).json({ message: "Contraseña incorrecta" });
    }

    const sessionId = uuidv4();
    let session = await sessionData.findSession(email);

    if (!session) {
      const now = new Date();
      session = {
        session_ID: sessionId,
        email,
        nickname: user.nickname,
        status: "active",
        createdAt: now,
        lastAccessedAt: now,
      };
      await sessionData.insert(session);
    } else {
      await sessionData.update(session.session_ID, {
        session_ID: sessionId,
        status: "active",
        lastAccessedAt: new Date(),
      });
    }

    req.session.user = { ...session, session_ID: sessionId };

    // Iniciar temporizador para inactividad
    startInactivityTimer(sessionId);

    return res.status(200).json({ message: "Inicio de sesión exitoso", sessionId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cerrar sesión
const logout = async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId ) {
    return res.status(400).json({ message: "El campo no puede ir vacío" });
  }

  try {
    const user = await sessionData.findSession(sessionId);
    
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    await sessionData.update(sessionId, {
      session_ID: `closed_${sessionId}`,
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
    return res.status(400).json({ message: "SessionId requerido" });
  }

  try {
    const session = await sessionData.findSession(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Sesión no encontrada" });
    }

    if (session.status === "inactive") {
      return res.status(200).json({
        message: `La sesión con ID ${session.session_ID} ya está inactiva. Necesita actualizarla.`,
      });
    }

    startInactivityTimer(session.session_ID);

    const { inactivityTime, isInactive } = calculateInactivity(session);

    if (isInactive && session.status !== "inactive") {
      await sessionData.update(session.session_ID, { status: "inactive" });
      return res.status(440).json({ message: "La sesión ha expirado por inactividad." });
    } else {
      await sessionData.update(session.session_ID, { lastAccessedAt: new Date() });
    }

    const createdAt = moment(session.createdAt).tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss");
    const lastAccessedAt = moment(session.lastAccessedAt).tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss");

    res.status(200).json({
      message: "Sesión activa",
      session: {
        sessionId: session.session_ID,
        email: session.email,
        nickname: session.nickname,
        macAddress: session.macAddress,
        ip: session.ip,
        createdAt,
        lastAccessedAt,
        status: isInactive ? "inactive" : session.status,
      },
      inactivityTime,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Listar sesiones activas
const listSessions = async (req, res) => {
  try {
    const sessions = await sessionData.showSessions();
    const updates = [];

    const formattedSessions = sessions.map((session) => {
      if (session.status === "finished by user") {
        return null;
      }

      const { inactivityTime, isInactive } = calculateInactivity(session);

      if (isInactive && session.status !== "inactive") {
        updates.push(sessionData.update(session.session_ID, { status: "inactive" }));
      }

      return {
        sessionId: session.session_ID,
        email: session.email,
        nickname: session.nickname,
        macAddress: session.macAddress,
        ip: session.ip,
        createdAt: moment(session.createdAt).format("YYYY-MM-DD HH:mm:ss"),
        lastAccessedAt: moment(session.lastAccessedAt).format("YYYY-MM-DD HH:mm:ss"),
        inactivityTime,
        status: isInactive ? "inactive" : session.status,
      };
    }).filter(session => session !== null);
    await Promise.all(updates);

    res.status(200).json({
      message: "Sesiones activas:",
      totalSessions: formattedSessions.length,
      sessions: formattedSessions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Mostrar las sesiones activas en al base de datos
const showSessions = async (req, res) => {
  try {
    // Obtener todos los usuarios
    const users = await userData.showUsers();

    // Obtener todas las sesiones registradas
    const sessions = await sessionData.showSessions();

    // Formatear los usuarios y agregar la información de sus sesiones
    const formattedUsers = await Promise.all(users.map(async (user) => {
      // Filtrar las sesiones que corresponden a este usuario
      const userSessions = sessions.filter(session => session.email === user.email);

      // Formatear las sesiones del usuario
      const formattedSessions = userSessions.map(session => ({
        sessionId: session.session_ID,
        ip: session.ip,
        createdAt: moment(session.createdAt).format("YYYY-MM-DD HH:mm:ss"),
        lastAccessedAt: moment(session.lastAccessedAt).format("YYYY-MM-DD HH:mm:ss"),
        status: session.status,
      }));

      return {
        user_id: user.user_id,
        email: user.email,
        nickname: user.nickname,
        ip: user.ip,
        sessions: formattedSessions
      };
    }));

    res.status(200).json({ message: "Usuarios registrados:", users: formattedUsers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//Actualizar usuario
const update = async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({ message: "sessionId requerido" });
  }

  try {
    await sessionData.update(sessionId, {
      status: "active",
      lastAccessedAt: new Date(),
    });

    startInactivityTimer(sessionId);

    res.status(200).json({ message: "Sesión actualizada exitosamente" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


//Borrar sesiones
const deleteSessions = async (req, res) => {
  try {
    await sessionData.delete();
    res.status(200).json({ message: "Sesiones eliminadas exitosamente" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//Borrar usuario
const deleteUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Ningún campo debe estar vacío" });
  }

  try {
    const user = await userData.findByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const { password: encryptedPassword } = user;
    let decryptedPass;

    try {
      decryptedPass = decryptData(encryptedPassword);
    } catch (error) {
      return res.status(400).json({ message: "Contraseña inválida o corrupta" });
    }

    if (password !== decryptedPass) {
      return res.status(403).json({ message: "Contraseña incorrecta" });
    }

    await userData.deleteUser(email);
    res.status(200).json({ message: "Usuario eliminado exitosamente" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export default {
  insert,
  login,
  logout,
  sessionStatus,
  listSessions,
  showSessions,
  update,
  deleteSessions,
  deleteUser,
};
