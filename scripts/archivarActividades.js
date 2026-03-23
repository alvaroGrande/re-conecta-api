/**
 * Script para archivar actividades antiguas
 * Puede ejecutarse manualmente o programarse con cron/task scheduler
 * 
 * Uso:
 *   node src/scripts/archivarActividades.js [dias_retencion] [limpiar_archivo]
 * 
 * Ejemplos:
 *   node src/scripts/archivarActividades.js           # Archivar > 90 días
 *   node src/scripts/archivarActividades.js 60        # Archivar > 60 días
 *   node src/scripts/archivarActividades.js 90 true   # Archivar + limpiar archivo > 365 días
 */

import pool from '../DAO/connection.js';
import logger from '../logger.js';

const DIAS_RETENCION_DEFECTO = 90;
const DIAS_ARCHIVO_DEFECTO = 365;

async function archivarActividades(diasRetencion = DIAS_RETENCION_DEFECTO) {
  try {
    logger.info(`Iniciando archivado de actividades anteriores a ${diasRetencion} días...`);
    
    const result = await pool.query(
      'SELECT * FROM archivar_actividades_antiguas($1)',
      [diasRetencion]
    );
    
    const archivados = result.rows[0].archivados;
    logger.info(`✓ ${archivados} actividades archivadas correctamente`);
    
    return archivados;
  } catch (error) {
    logger.error('Error al archivar actividades:', error);
    throw error;
  }
}

async function limpiarArchivoAntiguo(diasTotal = DIAS_ARCHIVO_DEFECTO) {
  try {
    logger.info(`Limpiando archivo de actividades anteriores a ${diasTotal} días...`);
    
    const result = await pool.query(
      'SELECT * FROM limpiar_archivo_antiguo($1)',
      [diasTotal]
    );
    
    const eliminados = result.rows[0].eliminados;
    logger.info(`✓ ${eliminados} registros de archivo eliminados`);
    
    return eliminados;
  } catch (error) {
    logger.error('Error al limpiar archivo:', error);
    throw error;
  }
}

async function obtenerEstadisticas() {
  try {
    const result = await pool.query(`
      SELECT 
        'Activa' as tabla,
        COUNT(*) as registros,
        MIN(fecha) as mas_antigua,
        MAX(fecha) as mas_reciente,
        pg_size_pretty(pg_total_relation_size('actividad_sistema')) as tamaño
      FROM actividad_sistema
      UNION ALL
      SELECT 
        'Archivo',
        COUNT(*),
        MIN(fecha),
        MAX(fecha),
        pg_size_pretty(pg_total_relation_size('actividad_sistema_archivo'))
      FROM actividad_sistema_archivo
    `);
    
    return result.rows;
  } catch (error) {
    logger.error('Error al obtener estadísticas:', error);
    return [];
  }
}

async function main() {
  const diasRetencion = parseInt(process.argv[2]) || DIAS_RETENCION_DEFECTO;
  const deberiaLimpiarArchivo = process.argv[3] === 'true';
  
  try {
    logger.info('=== SCRIPT DE ARCHIVADO DE ACTIVIDADES ===');
    
    // Mostrar estadísticas iniciales
    logger.info('\n📊 Estadísticas ANTES del archivado:');
    const statsAntes = await obtenerEstadisticas();
    console.table(statsAntes);
    
    // Archivar actividades antiguas
    const archivados = await archivarActividades(diasRetencion);
    
    // Limpiar archivo si se solicita
    if (deberiaLimpiarArchivo) {
      const eliminados = await limpiarArchivoAntiguo(DIAS_ARCHIVO_DEFECTO);
    }
    
    // Mostrar estadísticas finales
    logger.info('\n📊 Estadísticas DESPUÉS del archivado:');
    const statsDespues = await obtenerEstadisticas();
    console.table(statsDespues);
    
    logger.info('\n✅ Proceso completado exitosamente');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error en el proceso de archivado:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { archivarActividades, limpiarArchivoAntiguo, obtenerEstadisticas };
