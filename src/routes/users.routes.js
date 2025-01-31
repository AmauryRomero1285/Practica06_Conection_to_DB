import { Router } from "express";
import userController from "../src/controller/users.controller.js";

const userRouter = Router();

// Ruta de bienvenida
userRouter.get("/", (req, res) => {
  return res.status(200).json({
    message: "Bienvenid@ a la API de Control de Sesiones",
    author: "Yared Amaury Romero Martinez",
  });
});

// Rutas de usuario
userRouter.post("/register", userController.insert);
userRouter.put("/update/:sessionID", userController.update);
userRouter.get("/showUsers", userController.showUsers);

// Rutas de sesión
userRouter.post("/login", userController.login);
userRouter.post("/logout", userController.logout);
userRouter.post("/status", userController.sessionStatus);
userRouter.get("/currentSessions", userController.listSessions);

export default userRouter;
