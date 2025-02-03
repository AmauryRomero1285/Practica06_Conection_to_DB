import { Router } from "express";
import usersController from "../controller/users.controller.js"; 

const userRouter = Router();

// Ruta de bienvenida
userRouter.get("/", (req, res) => {
  return res.status(200).json({
    message: "Bienvenid@ a la API de Control de Sesiones",
    author: "Yared Amaury Romero Martinez",
  });
});

// Rutas de usuario
userRouter.post("/register", usersController.insert);
//userRouter.put("/update/:sessionID", usersController.update);
//userRouter.get("/showUsers", usersController.showUsers);

// Rutas de sesión
userRouter.post("/login", usersController.login);
userRouter.post("/logout", usersController.logout);
userRouter.post("/status", usersController.sessionStatus);
userRouter.get("/currentSessions", usersController.listSessions);

export default userRouter;
