import express from "express";
import session from "express-session";
import morgan from "morgan";
import bodyParser from "body-parser";
import cors from "cors";
import userRouter from "../src/routes/users.routes.js";

const app = express();
const activeSessions = {}; // Definimos las sesiones activas

// Configuración del servidor
app.set("port", process.env.PORT || 3000);
//middleware
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware para sesiones
app.use(
  session({
    secret: "P4-YARM#gokusupersaiyajin-SesionesHTTP-VariablesDeSesión",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1 día de duración
  })
);

// Usar las rutas de usuarios
app.use("/user", userRouter);

export default app;
