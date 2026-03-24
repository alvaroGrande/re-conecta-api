/**
 * Módulo central de permisos por rol.
 * 
 * Roles:
 *   1 = Administrador
 *   2 = Coordinador
 *   3 = Usuario
 * 
 * Formato de permiso: 'recurso:accion'
 */

export const ROLES = {
  ADMINISTRADOR: 1,
  COORDINADOR: 2,
  USUARIO: 3
};

export const PERMISOS = {
  // Dashboard
  DASHBOARD_VER: 'dashboard:ver',

  // Talleres
  TALLERES_VER: 'talleres:ver',
  TALLERES_CREAR: 'talleres:crear',
  TALLERES_EDITAR: 'talleres:editar',
  TALLERES_ELIMINAR: 'talleres:eliminar',
  TALLERES_ARCHIVAR: 'talleres:archivar',
  TALLERES_INSCRIBIR: 'talleres:inscribir',
  TALLERES_VER_INSCRITOS: 'talleres:ver_inscritos',
  TALLERES_ARCHIVADOS_VER: 'talleres_archivados:ver',

  // Usuarios
  USUARIOS_VER: 'usuarios:ver',
  USUARIOS_VER_DETALLE: 'usuarios:ver_detalle',
  USUARIOS_CREAR: 'usuarios:crear',
  USUARIOS_EDITAR: 'usuarios:editar',
  USUARIOS_ELIMINAR: 'usuarios:eliminar',

  // Encuestas
  ENCUESTAS_VER: 'encuestas:ver',
  ENCUESTAS_CREAR: 'encuestas:crear',
  ENCUESTAS_EDITAR: 'encuestas:editar',
  ENCUESTAS_ELIMINAR: 'encuestas:eliminar',
  ENCUESTAS_RESPONDER: 'encuestas:responder',

  // Calendario
  CALENDARIO_VER: 'calendario:ver',

  // Videollamadas
  VIDEOLLAMADAS_VER: 'videollamadas:ver',
  VIDEOLLAMADAS_CREAR: 'videollamadas:crear',
  VIDEOLLAMADAS_GESTIONAR: 'videollamadas:gestionar',

  // Perfil
  PERFIL_VER: 'perfil:ver',
  PERFIL_EDITAR: 'perfil:editar',

  // Notificaciones
  NOTIFICACIONES_VER: 'notificaciones:ver',
  NOTIFICACIONES_CREAR: 'notificaciones:crear',
  NOTIFICACIONES_GESTIONAR: 'notificaciones:gestionar',

  // Reportes / Analytics
  REPORTES_VER: 'reportes:ver',

  // Contactos
  CONTACTOS_VER: 'contactos:ver',
  CONTACTOS_GESTIONAR: 'contactos:gestionar',

  // Administración
  ROLES_GESTIONAR: 'roles:gestionar',
};

/**
 * Mapa de permisos por rol.
 * Cada rol hereda los permisos indicados.
 */
export const PERMISOS_POR_ROL = {
  [ROLES.ADMINISTRADOR]: Object.values(PERMISOS), // Administrador: todos los permisos

  [ROLES.COORDINADOR]: [
    PERMISOS.DASHBOARD_VER,

    PERMISOS.TALLERES_VER,
    PERMISOS.TALLERES_CREAR,
    PERMISOS.TALLERES_EDITAR,
    PERMISOS.TALLERES_INSCRIBIR,
    PERMISOS.TALLERES_VER_INSCRITOS,

    PERMISOS.USUARIOS_VER,
    PERMISOS.USUARIOS_VER_DETALLE,

    PERMISOS.ENCUESTAS_VER,
    PERMISOS.ENCUESTAS_CREAR,
    PERMISOS.ENCUESTAS_EDITAR,
    PERMISOS.ENCUESTAS_RESPONDER,

    PERMISOS.CALENDARIO_VER,

    PERMISOS.VIDEOLLAMADAS_VER,
    PERMISOS.VIDEOLLAMADAS_CREAR,

    PERMISOS.PERFIL_VER,
    PERMISOS.PERFIL_EDITAR,

    PERMISOS.NOTIFICACIONES_VER,
    PERMISOS.NOTIFICACIONES_CREAR,

    PERMISOS.REPORTES_VER,

    PERMISOS.CONTACTOS_VER,
    PERMISOS.CONTACTOS_GESTIONAR,
  ],

  [ROLES.USUARIO]: [
    PERMISOS.TALLERES_VER,
    PERMISOS.TALLERES_INSCRIBIR,

    PERMISOS.ENCUESTAS_VER,
    PERMISOS.ENCUESTAS_RESPONDER,

    PERMISOS.CALENDARIO_VER,

    PERMISOS.VIDEOLLAMADAS_VER,

    PERMISOS.PERFIL_VER,
    PERMISOS.PERFIL_EDITAR,

    PERMISOS.NOTIFICACIONES_VER,

    PERMISOS.CONTACTOS_VER,
  ],
};

/**
 * Verifica si un rol tiene un permiso concreto.
 * @param {number} rol - Número de rol del usuario
 * @param {string} permiso - Permiso a verificar (ej: 'talleres:crear')
 * @returns {boolean}
 */
export function tienePermiso(rol, permiso) {
  const permisos = PERMISOS_POR_ROL[rol];
  if (!permisos) return false;
  return permisos.includes(permiso);
}

/**
 * Retorna todos los permisos de un rol.
 * @param {number} rol
 * @returns {string[]}
 */
export function obtenerPermisosPorRol(rol) {
  return PERMISOS_POR_ROL[rol] ?? [];
}
