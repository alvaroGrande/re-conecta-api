import * as contactosDAO from "../DAO/contactosDAO.js";
import logger from "../logger.js";

/**
 * Obtener el instructor principal del usuario autenticado
 */
export const getInstructorPrincipal = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const instructor = await contactosDAO.obtenerInstructorPrincipal(usuarioId);
    
    if (!instructor) {
      return res.status(200).json({ 
        instructor: null,
        warning: "No tienes un instructor principal asignado" 
      });
    }

    res.json(instructor);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener todos los instructores asignados al usuario
 */
export const getInstructores = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const instructores = await contactosDAO.obtenerInstructoresAsignados(usuarioId);
    res.json(instructores);
  } catch (error) {
    next(error);
  }
};

/**
 * Asignar un instructor a un usuario (solo administradores)
 */
export const asignarInstructor = async (req, res, next) => {
  try {
    // Verificar que el usuario es administrador
    if (req.user.rol !== 1) {
      return res.status(403).json({ 
        message: "No tienes permisos para asignar instructores. Solo administradores." 
      });
    }

    const { usuario_id, instructor_id, es_principal } = req.body;

    if (!usuario_id || !instructor_id) {
      return res.status(400).json({ 
        message: "Faltan campos requeridos: usuario_id, instructor_id" 
      });
    }

    const asignacion = await contactosDAO.asignarInstructor(
      usuario_id,
      instructor_id,
      es_principal || false
    );

    res.status(201).json(asignacion);
  } catch (error) {
    next(error);
  }
};

/**
 * Cambiar el instructor principal (solo administradores)
 */
export const cambiarInstructorPrincipal = async (req, res, next) => {
  try {
    if (req.user.rol !== 1) {
      return res.status(403).json({ 
        message: "No tienes permisos para cambiar instructores. Solo administradores." 
      });
    }

    const { usuario_id, instructor_id } = req.body;

    if (!usuario_id || !instructor_id) {
      return res.status(400).json({ 
        message: "Faltan campos requeridos: usuario_id, instructor_id" 
      });
    }

    const resultado = await contactosDAO.cambiarInstructorPrincipal(
      usuario_id,
      instructor_id
    );

    res.json(resultado);
  } catch (error) {
    next(error);
  }
};

/**
 * Estrategias para obtener contactos según el rol
 */
const estrategiasContactos = {
  1: async (usuarioId, page, limit, search, res) => {
    // Administrador: todos los instructores
    const startTime = Date.now();
    const resultado = await contactosDAO.obtenerTodosInstructores(page, limit, search);
    const duration = Date.now() - startTime;
    
    res.setHeader('X-Cache', resultado.fromCache ? 'HIT' : 'MISS');
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    logger.info({
      rol: 'admin',
      endpoint: 'todos-instructores',
      cache: resultado.fromCache ? 'HIT' : 'MISS',
      duration: `${duration}ms`,
      total: resultado.data.total
    });
    
    return resultado.data;
  },
  
  2: async (usuarioId, page, limit, search) => {
    // Coordinador: usuarios coordinados
    const resultado = await contactosDAO.obtenerUsuariosCoordinados(usuarioId, page, limit, search);
    logger.info({
      rol: 'coordinador',
      usuarioId,
      count: resultado.data.length,
      total: resultado.total
    });
    return resultado;
  },
  
  3: async (usuarioId, page, limit, search) => {
    // Usuario normal: contactos
    return await contactosDAO.obtenerContactos(usuarioId, page, limit, search);
  }
};

/**
 * Obtener la lista de contactos del usuario autenticado
 * - Administrador (rol 1): todos los instructores/supervisores
 * - Instructor (rol 2): usuarios que coordina
 * - Usuario normal (rol 3): contactos personales
 */
export const getContactos = async (req, res, next) => {
  try {
    const { id: usuarioId, rol: rolUsuario } = req.user;
    const { page = 1, limit = 20, search = '' } = req.query;
    
    const params = [usuarioId, parseInt(page), parseInt(limit), search, res];
    const estrategia = estrategiasContactos[rolUsuario];
    
    if (!estrategia) {
      return res.status(400).json({ message: 'Rol de usuario no válido' });
    }
    
    const resultado = await estrategia(...params);
    res.json(resultado);
  } catch (error) {
    logger.error('[CONTACTOS] Error:', error);
    next(error);
  }
};

/**
 * Agregar un nuevo contacto
 * Si es instructor (rol 2), automáticamente se asigna como instructor principal del usuario
 */
export const agregarContacto = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const rolUsuario = req.user.rol;
    const { contacto_id } = req.body;

    if (!contacto_id) {
      return res.status(400).json({ 
        message: "El campo contacto_id es requerido" 
      });
    }

    // Si es instructor, asignar como instructor principal del usuario
    if (rolUsuario === 2) {
      const asignacion = await contactosDAO.asignarInstructor(contacto_id, usuarioId, true);
      return res.status(201).json({ 
        success: true, 
        message: "Usuario agregado a tu coordinación",
        asignacion 
      });
    }

    // Si es usuario normal, agregar como contacto
    const contacto = await contactosDAO.agregarContacto(usuarioId, contacto_id);
    res.status(201).json({ 
      success: true, 
      message: "Contacto agregado correctamente",
      contacto 
    });
  } catch (error) {
    if (error.message === "No puedes agregarte a ti mismo como contacto") {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === "El usuario no existe") {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === "Este contacto ya está agregado") {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Eliminar un contacto
 * Si es instructor (rol 2), elimina la asignación de instructor
 */
export const eliminarContacto = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const rolUsuario = req.user.rol;
    const contactoId = req.params.id;

    // Si es instructor, eliminar la asignación de instructor
    if (rolUsuario === 2) {
      await contactosDAO.desasignarInstructor(contactoId, usuarioId);
      return res.json({ 
        success: true, 
        message: "Usuario eliminado de tu coordinación" 
      });
    }

    // Si es usuario normal, eliminar contacto
    await contactosDAO.eliminarContacto(usuarioId, contactoId);
    
    res.json({ 
      success: true, 
      message: "Contacto eliminado correctamente" 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar usuarios para agregar como contacto
 */
export const buscarUsuarios = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { q } = req.query; // término de búsqueda

    const usuarios = await contactosDAO.buscarUsuariosParaContacto(usuarioId, q);
    res.json(usuarios);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener usuarios sin supervisor asignado (solo administradores)
 */
export const getUsuariosSinSupervisor = async (req, res, next) => {
  try {
    // Verificar que el usuario sea administrador
    if (req.user.rol !== 1) {
      return res.status(403).json({ 
        success: false, 
        message: "Acceso denegado. Solo administradores." 
      });
    }

    const usuarios = await contactosDAO.obtenerUsuariosSinSupervisor();
    res.json(usuarios);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener usuarios coordinados por un instructor específico (solo administradores)
 */
export const getUsuariosDeInstructor = async (req, res, next) => {
  try {
    // Verificar que el usuario sea administrador
    if (req.user.rol !== 1) {
      return res.status(403).json({ 
        success: false, 
        message: "Acceso denegado. Solo administradores." 
      });
    }

    const { instructorId } = req.params;
    const usuarios = await contactosDAO.obtenerUsuariosCoordinados(instructorId);
    res.json(usuarios);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener lista de instructores disponibles
 */
export const getInstructoresDisponibles = async (req, res, next) => {
  try {
    const instructores = await contactosDAO.obtenerInstructoresDisponibles();
    res.json(instructores);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener conteos de supervisores por filtro (solo administradores)
 */
export const getConteosSupervisores = async (req, res, next) => {
  try {
    // Verificar que el usuario sea administrador
    if (req.user.rol !== 1) {
      return res.status(403).json({ 
        success: false, 
        message: "Acceso denegado. Solo administradores." 
      });
    }

    const conteos = await contactosDAO.obtenerConteosSupervisores();
    res.json(conteos);
  } catch (error) {
    next(error);
  }
};
