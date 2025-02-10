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
    return res
      .status(400)
      .json({ message: "Todos los campos son obligatorios" });
  }

  try {
    const user = await userData.findByEmail(email);
    if (!user) {
      return res
        .status(400)
        .json({ message: "El Usuario no se encuentra registrado." });
    }

    const { password:encryptedPassword, nickname } = user;

    let decryptedPass;
    try {
      decryptedPass = decryptData(encryptedPassword);
    } catch (error) {
      return res.status(400).json({ message: "Error al desencriptar la contraseña" });
    }

    if (decryptedPass !== password) {
      return res.status(400).json({ message: "Contraseña incorrecta" });
    }

    const sessionId = uuidv4();
    let session = await sessionData.findSession(email);

    if (!session) {
      // Crear una nueva sesión si el email no tiene sesión activa
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
    } else {
      // Actualizar el session_ID si la sesión ya existe
      await sessionData.update(session.session_ID, {
        session_ID: sessionId,
        status: "active",
        lastAccessedAt: new Date(),
      });
    }

    req.session.user = { ...session, session_ID: sessionId };

    return res
      .status(200)
      .json({ message: session ? "Sesión actualizada" : "Nueva sesión creada", sessionId });

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

    res.status(200).json({
      message: "Sesión activa",
      session,
      inactivityTime: calculateSessionInactivity(sessionId,session.lastAccessedAt),
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
      message: "Sesiones: ",
      totalSessions: formattedSessions.length,
      sessions: formattedSessions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Mostrar las sesiones activas en al base de datos
const showUsers = async (req, res) => {
  try {
    const users = await userData.showUsers();
    res.status(200).json({ message: "Usuarios registrados: ", users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//Actualizar usuario
const update = async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    await sessionData.update(sessionId, {
      status: "active",
      lastAccessedAt: new Date(),
    });
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

    const { password } = user;
    let decryptedPass;
    
    try {
      decryptedPass = decryptData(password);
    } catch (error) {
      return res.status(400).json({ message: "Contraseña inválida o corrupta" });
    }

    if (decryptedpassword !== decryptedPass) {
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
  showUsers,
  update,
  deleteSessions,
  deleteUser,
};
