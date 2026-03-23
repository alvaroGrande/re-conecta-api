import { createToken} from '../utils/jwt.js';
import * as userDAO from "../DAO/userDAO.js";
import * as dashboardDAO from "../DAO/dashboardDAO.js";
import logger from '../logger.js';

export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        logger.info(`Intento de login para email: ${email}`);
        if (!email || !password) {
            return res.status(400).json({ok : false, message: 'Email y contraseña son requeridos.' });
        }
        const user = await userDAO.getUserByEmail(email);
        if (!user) {
            return res.status(401).json({ ok : false, message: 'Credenciales inválidas.' });
        }

        // const match = "Admin"
        if (password !== "Admin") {
            return res.status(401).json({ ok : false, message: 'Credenciales inválidas.' });
        }
        
        // Actualizar ultimoInicio y ultima_actividad
        await userDAO.actualizarUltimoInicio(user[0].id);
        
        // Obtener el usuario actualizado
        const usuarioActualizado = await userDAO.getUserByEmail(email);
        
        const accessToken = await createToken(usuarioActualizado[0], '8h');
        res.json({
            ok : true,
            message: 'Autenticación exitosa.',
            accessToken,
            usuario : usuarioActualizado[0]
            // user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (err) {
        logger.error({ err }, 'Error en login');
        res.status(500).json({ error: 'Error del servidor.' });
    }
}

export async function logout(req, res) {
    try {
        const userId = req.user?.id;
        const { motivo = 'manual' } = req.body;
        
        if (userId) {
            // Marcar usuario como desconectado
            await userDAO.marcarUsuarioDesconectado(userId);
            
            // Registrar actividad de logout con el motivo
            const usuario = await userDAO.getUserById(userId);
            const mensajeMotivo = motivo === 'inactividad' 
                ? 'cerró sesión por inactividad'
                : 'cerró sesión manualmente';
            
            await dashboardDAO.registrarActividad(
                userId,
                'logout',
                `Usuario desconectado (${motivo})`,
                `${usuario.nombre} ${usuario.Apellidos} ${mensajeMotivo}`
            );
            
            logger.info(`Usuario ${userId} cerró sesión (motivo: ${motivo})`);
        }
        
        res.json({ ok: true, message: 'Sesión cerrada correctamente.' });
    } catch (err) {
        logger.error({ err }, 'Error en logout');
        res.status(500).json({ error: 'Error del servidor.' });
    }
}

async function refreshToken(req, res) {
    try {
        const token = req.cookies && req.cookies[REFRESH_COOKIE_NAME];
        if (!token) {
            return res.status(401).json({ error: 'Refresh token no encontrado.' });
        }

        let payload;
        try {
            payload = jwt.verify(token, JWT_SECRET);
        } catch (e) {
            return res.status(401).json({ error: 'Refresh token inválido.' });
        }

        const user = await User.findById(payload.id);
        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado.' });
        }

        const accessToken = createAccessToken(user);
        // Opcional: emitir nuevo refresh token
        const newRefreshToken = createRefreshToken(user);
        res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            path: '/api/auth/refresh',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ accessToken });
    } catch (err) {
        logger.error({ err }, 'Error en refreshToken');
        res.status(500).json({ error: 'Error del servidor.' });
    }
}

export async function getProfile(req, res) {
    try {
        // Se asume que hay middleware que deja req.user con el id
        const userId = req.user && req.user.id;
        if (!userId) return res.status(401).json({ error: 'No autenticado.' });

        const user = await User.findById(userId).select('-password');
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

        res.json({ user });
    } catch (err) {
        logger.error({ err }, 'Error en getProfile');
        res.status(500).json({ error: 'Error del servidor.' });
    }
}