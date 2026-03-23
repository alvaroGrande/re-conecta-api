import jwt from 'jsonwebtoken'
import logger from '../logger.js';

import config from  '../config.js';
const { SECRET } = config.JWT;
export const createToken = async (payload, expirationTime) => {
  try {
    if(expirationTime){
      const token = jwt.sign(payload, SECRET, { expiresIn: expirationTime });
      return token;
    } else {
      const token = jwt.sign(payload, SECRET);
      return token;
    }
  } catch (error) {
    logger.error({ error }, 'Error al crear el token');
    throw new Error('Error al crear el token');
  }
};

export const verifyToken = async (req, res, next) => {
    const token = req.headers['authorization'];
    jwt.verify(token, SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ ok: false, message: 'Token inválido o expirado.' });
        }
        else 
            next();
    })
}