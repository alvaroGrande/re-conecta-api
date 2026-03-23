import { Router } from "express";
import {
  getInstructorPrincipal,
  getInstructores,
  asignarInstructor,
  cambiarInstructorPrincipal,
  getContactos,
  agregarContacto,
  eliminarContacto,
  buscarUsuarios,
  getInstructoresDisponibles,
  getUsuariosSinSupervisor,
  getUsuariosDeInstructor,
  getConteosSupervisores
} from "../Controllers/contactosController.js";

const router = Router();

// Rutas de instructores
router.get("/instructor-principal", getInstructorPrincipal);
router.get("/instructores", getInstructores);
router.get("/instructores-disponibles", getInstructoresDisponibles);
router.post("/instructores/asignar", asignarInstructor); // Solo admin
router.patch("/instructores/cambiar-principal", cambiarInstructorPrincipal); // Solo admin

// Rutas de contactos
router.get("/contactos", getContactos);
router.post("/contactos", agregarContacto);
router.delete("/contactos/:id", eliminarContacto);
router.get("/buscar", buscarUsuarios);

// Rutas de administración
router.get("/usuarios-sin-supervisor", getUsuariosSinSupervisor);
router.get("/instructores/:instructorId/usuarios", getUsuariosDeInstructor);
router.get("/supervisores/conteos", getConteosSupervisores);

export default router;
