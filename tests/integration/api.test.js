import request from 'supertest';
import app from '../../src/app.js';

describe('API Integration Tests', () => {
  let authToken;

  // Antes de todas las pruebas, hacer login para obtener token
  beforeAll(async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'test123'
      });
    
    authToken = response.body.token;
  });

  describe('GET /api/usuarios', () => {
    it('debería retornar 401 sin token', async () => {
      const response = await request(app)
        .get('/api/usuarios');
      
      expect(response.status).toBe(401);
    });

    it('debería retornar usuarios con token válido', async () => {
      const response = await request(app)
        .get('/api/usuarios')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/dashboard/estadisticas', () => {
    it('debería retornar estadísticas del dashboard', async () => {
      const response = await request(app)
        .get('/api/dashboard/estadisticas')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalUsuarios');
      expect(response.body).toHaveProperty('usuariosActivos');
    });
  });
});
