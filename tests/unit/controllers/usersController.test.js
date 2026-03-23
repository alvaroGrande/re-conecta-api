import { getUsuarios } from '../../../src/Controllers/usersController.js';

describe('usersController', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      user: { id: 1, rol: 1 },
      query: {}
    };
    
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
  });

  describe('getUsuarios', () => {
    it('debería retornar usuarios correctamente', async () => {
      await getUsuarios(mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debería manejar errores correctamente', async () => {
      mockReq.user = null; // Simular falta de usuario
      
      await getUsuarios(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
