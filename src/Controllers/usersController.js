import * as userDAO from "../DAO/userDAO.js";
import logger from "../logger.js";
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const CHUNK_DIR = join(tmpdir(), 'reconecta-foto-chunks');
const MIME_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Crear directorio de chunks al arrancar
mkdir(CHUNK_DIR, { recursive: true }).catch(() => {});

export const getUsers = async (req, res, next) => {
  try {
    const { role, email, name, limit, offset } = req.query;
    const usuarioId = req.user.id;
    const rolUsuario = req.user.rol;
    
    const filters = { role, email, name };
    const options = {};
    if (limit) options.limit = limit;
    if (offset) options.offset = offset;
    
    // Si es coordinador (rol 2), solo puede ver sus usuarios asignados
    if (rolUsuario === 2) {
      filters.coordinadorId = usuarioId;
    }
    // Si es usuario normal (rol 3), no puede acceder a esta lista
    else if (rolUsuario === 3) {
      return res.status(403).json({ message: "No tienes permisos para ver la lista de usuarios" });
    }
    // Si es admin (rol 1), puede ver todos los usuarios
    
    const result = await userDAO.getAllUsers(filters, options, rolUsuario, usuarioId);
    // result: { data, total }
    res.json({ data: result.data, total: result.total });
  } catch (error) {
    logger.error(`[USERS] Error al obtener usuarios: ${error.message}`);
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await userDAO.getUserById(req.params.id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ message: "Nombre y email son requeridos" });

    const existing = await userDAO.getUserByEmail(email);
    if (existing && existing.length > 0) return res.status(409).json({ message: "El email ya está registrado" });

    // TODO: Considerar hashear contraseña antes de almacenar
    const newUser = await userDAO.createUser(req.body);
    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const updated = await userDAO.updateUserById(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Usuario no encontrado" });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const deleted = await userDAO.deleteUserById(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Usuario no encontrado" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Subir foto de perfil por chunks
 * Body: { sessionId: UUID, index: number, total: number, mimeType: string, data: string (base64) }
 * Cuando llega el último chunk, ensambla y guarda en Supabase.
 */
export const uploadPhotoChunk = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { sessionId, index, total, mimeType, data } = req.body;

    // -- Validaciones de entrada --
    if (!sessionId || !UUID_RE.test(sessionId)) {
      return res.status(400).json({ message: 'sessionId inválido (debe ser UUID)' });
    }
    if (!MIME_PERMITIDOS.has(mimeType)) {
      return res.status(400).json({ message: 'Tipo de imagen no permitido' });
    }
    if (typeof index !== 'number' || typeof total !== 'number' ||
        index < 0 || total < 1 || total > 200 || index >= total) {
      return res.status(400).json({ message: 'index o total inválidos' });
    }
    if (typeof data !== 'string' || data.length === 0) {
      return res.status(400).json({ message: 'data vacío' });
    }

    // -- Autorización: solo el propio usuario o admin --
    if (req.user.id !== userId && req.user.rol !== 1) {
      return res.status(403).json({ message: 'Sin permisos para modificar este usuario' });
    }

    // Guardar el chunk en disco (nombre seguro: UUID + índice numérico)
    const chunkPath = join(CHUNK_DIR, `${sessionId}_${index}`);
    await writeFile(chunkPath, data, 'utf8');

    // Comprobar si todos los chunks han llegado
    const reads = await Promise.all(
      Array.from({ length: total }, (_, i) =>
        readFile(join(CHUNK_DIR, `${sessionId}_${i}`), 'utf8').catch(() => null)
      )
    );

    const allPresent = reads.every(r => r !== null);
    if (!allPresent) {
      const received = reads.filter(r => r !== null).length;
      return res.json({ received, remaining: total - received });
    }

    // Ensamblar base64 completo y limpiar temp files
    const fullBase64 = `data:${mimeType};base64,${reads.join('')}`;
    const paths = Array.from({ length: total }, (_, i) => join(CHUNK_DIR, `${sessionId}_${i}`));
    await Promise.all(paths.map(p => unlink(p).catch(() => {})));

    const result = await userDAO.updateProfilePhoto(userId, fullBase64);
    res.json({
      message: 'Foto de perfil actualizada correctamente',
      foto_perfil: result.foto_perfil,
      user: result
    });
  } catch (error) {
    logger.error(`[PHOTO CHUNK] Error: ${error.message}`);
    next(error);
  }
};

/**
 * Subir foto de perfil de un usuario
 */
export const uploadProfilePhoto = async (req, res, next) => {
  try {
    const userId = req.params.id;
    
    if (!req.body.foto) {
      return res.status(400).json({ message: "No se proporcionó ninguna foto" });
    }

    // req.body.foto contiene los datos de la imagen en base64
    const fotoData = req.body.foto;
    
    // Validar que sea un formato base64 válido
    if (!fotoData.includes('base64') && !fotoData.match(/^[A-Za-z0-9+/=]+$/)) {
      return res.status(400).json({ message: "Formato de imagen inválido" });
    }
    
    const result = await userDAO.updateProfilePhoto(userId, fotoData);
    res.json({
      message: "Foto de perfil actualizada correctamente",
      user: result
    });
  } catch (error) {
    logger.error(`[PHOTO] Error al subir foto de perfil: ${error.message}`);
    next(error);
  }
};
