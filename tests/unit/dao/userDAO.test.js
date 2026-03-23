import { obtenerUsuarios } from '../../../src/DAO/userDAO.js';

describe('userDAO', () => {
  describe('obtenerUsuarios', () => {
    it('debería retornar un array de usuarios', async () => {
      const usuarios = await obtenerUsuarios();
      
      expect(Array.isArray(usuarios)).toBe(true);
      
      if (usuarios.length > 0) {
        const usuario = usuarios[0];
        expect(usuario).toHaveProperty('id');
        expect(usuario).toHaveProperty('email');
        expect(usuario).toHaveProperty('nombre');
      }
    });

    it('debería filtrar usuarios por rol', async () => {
      const filtros = { rol: 1 }; // Admin
      const usuarios = await obtenerUsuarios(filtros);
      
      usuarios.forEach(usuario => {
        expect(usuario.rol).toBe(1);
      });
    });
  });
});
