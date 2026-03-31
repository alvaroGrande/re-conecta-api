#!/usr/bin/env node

/**
 * Script de prueba para el sistema de notificaciones extendido
 * Ejecutar con: node scripts/test-notificaciones.js
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const axios = require('axios');
const fs = require('fs');

const API_BASE = 'http://localhost:3000/api';

async function testNotificaciones() {
    console.log('🧪 Iniciando pruebas del sistema de notificaciones...\n');

    try {
        // 1. Verificar estado de servicios
        console.log('1. Verificando estado de servicios...');
        const serviciosResponse = await axios.get(`${API_BASE}/notificaciones/servicios/estado`);
        console.log('✅ Servicios:', serviciosResponse.data);

        // 2. Obtener plantillas disponibles
        console.log('\n2. Obteniendo plantillas disponibles...');
        const plantillasResponse = await axios.get(`${API_BASE}/notificaciones/plantillas`);
        console.log('✅ Plantillas encontradas:', plantillasResponse.data.length);

        // 3. Crear notificación push de prueba
        console.log('\n3. Creando notificación push de prueba...');
        const pushResponse = await axios.post(`${API_BASE}/notificaciones`, {
            receptor_id: 'test-user-id',
            tipo: 'prueba',
            titulo: 'Notificación de Prueba',
            contenido: 'Esta es una notificación de prueba del sistema extendido',
            canal: 'push'
        });
        console.log('✅ Push creado:', pushResponse.data.id);

        // 4. Crear notificación email de prueba
        console.log('\n4. Creando notificación email de prueba...');
        const emailResponse = await axios.post(`${API_BASE}/notificaciones`, {
            receptor_id: 'test-user-id',
            tipo: 'prueba',
            titulo: 'Email de Prueba',
            contenido: 'Contenido del email de prueba',
            canal: 'email',
            plantilla_codigo: 'nuevo_taller'
        });
        console.log('✅ Email encolado:', emailResponse.data.id);

        // 5. Verificar configuración de usuario
        console.log('\n5. Verificando configuración de usuario...');
        const configResponse = await axios.get(`${API_BASE}/notificaciones/config`);
        console.log('✅ Configuración:', configResponse.data);

        // 6. Actualizar configuración
        console.log('\n6. Actualizando configuración de usuario...');
        await axios.put(`${API_BASE}/notificaciones/config`, {
            tipo_evento: 'nuevo_taller',
            canal: 'email',
            activo: true
        });
        console.log('✅ Configuración actualizada');

        // 7. Verificar cola de notificaciones
        console.log('\n7. Verificando cola de notificaciones...');
        const colaResponse = await axios.get(`${API_BASE}/notificaciones/cola`);
        console.log('✅ Notificaciones en cola:', colaResponse.data.length);

        console.log('\n🎉 Todas las pruebas pasaron exitosamente!');
        console.log('\n📋 Próximos pasos:');
        console.log('1. Ejecuta el worker: npm run worker:notificaciones');
        console.log('2. Verifica que los emails se envíen');
        console.log('3. Prueba notificaciones automáticas creando un taller');

    } catch (error) {
        console.error('❌ Error en las pruebas:', error.response?.data || error.message);

        if (error.response?.status === 401) {
            console.log('\n🔐 Necesitas autenticarte primero');
        } else if (error.response?.status === 500) {
            console.log('\n🔧 Verifica la configuración de servicios externos');
        }
    }
}

// Ejecutar pruebas si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    testNotificaciones();
}

export { testNotificaciones };