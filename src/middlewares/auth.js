import jwt from 'jsonwebtoken'
import config from  '../config.js';
import { tienePermiso } from '../config/rolePermissionsStore.js';
const { SECRET } = config.JWT;

/**
 * Middleware de roles. Uso: requireRole(1) o requireRole(1, 2)
 * rol 1 = Administrador, rol 2 = Coordinador, rol 3 = Usuario
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'No autenticado' });
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ message: 'Sin permisos suficientes' });
    }
    next();
  };
}

/**
 * Middleware de permisos granulares. Uso: requirePermission('talleres:crear')
 * Permite proteger rutas por acción específica en lugar de solo por rol.
 * @param {string} permiso - Permiso requerido (ej: 'talleres:crear')
 */
export function requirePermission(permiso) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'No autenticado' });
    const autorizado = await tienePermiso(req.user.rol, permiso);
    if (!autorizado) {
      return res.status(403).json({ message: `Acción no permitida: se requiere el permiso '${permiso}'` });
    }
    next();
  };
}

export function verifyToken(req, res, next) {
  try {
    // Obtenemos el header Authorization: "Bearer <token>"
    const authHeader = req.headers['authorization']
    
    if (!authHeader) {
      return res.status(401).json({ message: 'Token no proporcionado' })
    }

    // Extraemos el token quitando el prefijo "Bearer "
    const token = authHeader.split(' ')[1]

    if (!token) {
      return res.status(401).json({ message: 'Token inválido o mal formado' })
    }

    // Verificamos el token
    const decoded = jwt.verify(token, SECRET || 'JWT_SECRET')

    // Guardamos el usuario decodificado en el request para usarlo después
    req.user = decoded.user || decoded

    // Continuamos con la siguiente función o ruta
    next()
  } catch (error) {
    // No importar logger aquí para evitar dependencia circular, usar console solo para este caso
    return res.status(401).json({ message: 'Token inválido o expirado' })
  }
}
