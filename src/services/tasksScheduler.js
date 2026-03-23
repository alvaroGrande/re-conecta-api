import cron from 'node-cron';
import logger from '../logger.js';
import * as tasksDAO from '../DAO/tasksDAO.js';
import { archivarTalleresExpirados } from '../DAO/talleresDAO.js';

// Configuración: cambiar a '0 1 * * *' para producción (1 AM diario)
const CRON_ARCHIVADO_TESTING = '*/3 * * * *'; // Cada 3 minutos (TESTING)
const CRON_ARCHIVADO_PRODUCCION = '0 1 * * *'; // 1 AM diario (PRODUCCIÓN)

// Archivado de talleres
const CRON_TALLERES_TESTING = '*/2 * * * *';    // Cada 2 minutos (TESTING)
const CRON_TALLERES_PRODUCCION = '0 3 * * *';   // 3 AM diario (PRODUCCIÓN)

// Variable para controlar el modo
const MODO_TESTING = process.env.TASKS_TESTING_MODE === 'true';
const DIAS_RETENCION = parseInt(process.env.DIAS_RETENCION_ACTIVIDADES) || 90;
const DIAS_ARCHIVO_TOTAL = parseInt(process.env.DIAS_ARCHIVO_TOTAL) || 365;
const DIAS_RETENCION_QUERY_LOGS = parseInt(process.env.DIAS_RETENCION_QUERY_LOGS) || 30;

/**
 * Tarea: Archivar talleres expirados (fecha > 7 días)
 */
async function tareaArchivarTalleres() {
  const nombreTarea = 'archivado_talleres';
  let logInfo;
  try {
    logger.info(`[TAREA PROGRAMADA] Iniciando: ${nombreTarea}`);
    logInfo = await tasksDAO.registrarInicioTarea(nombreTarea);

    const archivados = await archivarTalleresExpirados(7);

    const mensaje = archivados === 0
      ? 'No hay talleres expirados para archivar'
      : `${archivados} taller(es) archivado(s) correctamente`;

    await tasksDAO.registrarFinTarea(logInfo.id, {
      registrosProcesados: archivados,
      registrosArchivados: archivados,
      mensaje,
      detalles: { diasMinimos: 7, fechaEjecucion: new Date().toISOString() }
    }, logInfo.timestampInicio);

    logger.info(`[TAREA PROGRAMADA] ${nombreTarea} completada: ${mensaje}`);
  } catch (error) {
    logger.error(`[TAREA PROGRAMADA] Error en ${nombreTarea}:`, error);
    if (logInfo) await tasksDAO.registrarErrorTarea(logInfo.id, error, logInfo.timestampInicio);
  }
}

/**
 * Tarea: Archivar actividades antiguas
 */
async function tareaArchivarActividades() {
  const nombreTarea = 'archivado_actividades';
  let logInfo;

  try {
    logger.info(`[TAREA PROGRAMADA] Iniciando: ${nombreTarea}`);
    logInfo = await tasksDAO.registrarInicioTarea(nombreTarea);

    // Ejecutar archivado
    const resultadoArchivado = await tasksDAO.ejecutarArchivadoActividades(DIAS_RETENCION);
    const archivados = resultadoArchivado.archivados || 0;

    // Si no hay actividades para archivar, registrar y terminar
    if (archivados === 0) {
      await tasksDAO.registrarFinTarea(logInfo.id, {
        registrosProcesados: 0,
        registrosArchivados: 0,
        mensaje: `No hay actividades anteriores a ${DIAS_RETENCION} días para archivar`,
        detalles: {
          diasRetencion: DIAS_RETENCION,
          fechaEjecucion: new Date().toISOString()
        }
      }, logInfo.timestampInicio);
      logger.info(`[TAREA PROGRAMADA] ${nombreTarea}: No hay datos para archivar`);
      return;
    }

    // Ejecutar limpieza de archivo antiguo
    const resultadoLimpieza = await tasksDAO.ejecutarLimpiezaArchivo(DIAS_ARCHIVO_TOTAL);
    const eliminados = resultadoLimpieza.eliminados || 0;

    // Obtener estadísticas finales
    const estadisticas = await tasksDAO.obtenerEstadisticasActividad();

    const mensaje = `Archivadas ${archivados} actividades (>${DIAS_RETENCION} días). Eliminadas ${eliminados} del archivo (>${DIAS_ARCHIVO_TOTAL} días)`;

    await tasksDAO.registrarFinTarea(logInfo.id, {
      registrosProcesados: archivados + eliminados,
      registrosArchivados: archivados,
      registrosEliminados: eliminados,
      mensaje,
      detalles: {
        diasRetencion: DIAS_RETENCION,
        diasArchivoTotal: DIAS_ARCHIVO_TOTAL,
        fechaMasAntiguaArchivada: resultadoArchivado.fecha_mas_antigua,
        fechaMasRecienteArchivada: resultadoArchivado.fecha_mas_reciente,
        estadisticasTablas: estadisticas,
        modoTesting: MODO_TESTING
      }
    }, logInfo.timestampInicio);

    logger.info(`[TAREA PROGRAMADA] ${nombreTarea} completada: ${mensaje}`);

  } catch (error) {
    logger.error(`[TAREA PROGRAMADA] Error en ${nombreTarea}:`, error);
    
    if (logInfo) {
      await tasksDAO.registrarErrorTarea(logInfo.id, error, logInfo.timestampInicio);
    }
  }
}

/**
 * Tarea: Limpiar logs de queries antiguas
 */
async function tareaLimpiarQueryLogs() {
  const nombreTarea = 'limpieza_query_logs';
  let logInfo;

  try {
    logger.info(`[TAREA PROGRAMADA] Iniciando: ${nombreTarea}`);
    logInfo = await tasksDAO.registrarInicioTarea(nombreTarea);

    // Ejecutar limpieza (mantener solo los días configurados)
    const resultado = await tasksDAO.limpiarQueryLogsAntiguos(DIAS_RETENCION_QUERY_LOGS);
    const eliminados = resultado.eliminados || 0;

    const mensaje = `Eliminados ${eliminados} registros de query logs (>${DIAS_RETENCION_QUERY_LOGS} dias)`;

    await tasksDAO.registrarFinTarea(logInfo.id, {
      registrosProcesados: eliminados,
      registrosEliminados: eliminados,
      mensaje,
      detalles: {
        diasRetencion: DIAS_RETENCION_QUERY_LOGS,
        fechaEjecucion: new Date().toISOString()
      }
    }, logInfo.timestampInicio);

    logger.info(`[TAREA PROGRAMADA] ${nombreTarea} completada: ${mensaje}`);

  } catch (error) {
    logger.error(`[TAREA PROGRAMADA] Error en ${nombreTarea}:`, error);
    
    if (logInfo) {
      await tasksDAO.registrarErrorTarea(logInfo.id, error, logInfo.timestampInicio);
    }
  }
}

/**
 * Inicializar todas las tareas programadas
 */
export function inicializarTareasProgramadas() {
  const cronExpression = MODO_TESTING ? CRON_ARCHIVADO_TESTING : CRON_ARCHIVADO_PRODUCCION;
  const cronQueryLogs = '0 2 * * *'; // Diariamente a las 2:00 AM
  
  logger.info('==================================================');
  logger.info('INICIALIZANDO TAREAS PROGRAMADAS');
  logger.info('==================================================');
  logger.info(`Modo: ${MODO_TESTING ? 'TESTING' : 'PRODUCCION'}`);
  logger.info(`Expresion cron: ${cronExpression}`);
  logger.info(`Descripcion: ${MODO_TESTING ? 'Cada 3 minutos' : 'Diariamente a la 1:00 AM'}`);
  logger.info(`Retencion actividades: ${DIAS_RETENCION} dias`);
  logger.info(`Retencion archivo: ${DIAS_ARCHIVO_TOTAL} dias`);
  logger.info(`Retencion query logs: ${DIAS_RETENCION_QUERY_LOGS} dias`);
  logger.info('==================================================');

  // Tarea de archivado de talleres expirados
  const cronTalleres = MODO_TESTING ? CRON_TALLERES_TESTING : CRON_TALLERES_PRODUCCION;
  cron.schedule(cronTalleres, async () => {
    await tareaArchivarTalleres();
  }, { timezone: 'Europe/Madrid' });

  logger.info('Tarea programada: Archivado de talleres expirados');
  logger.info(`  Programacion: ${MODO_TESTING ? 'Cada 90 segundos (testing)' : 'Diariamente a las 3:00 AM'}`);

  // Tarea de archivado de actividades
  cron.schedule(cronExpression, async () => {
    await tareaArchivarActividades();
  }, {
    timezone: 'Europe/Madrid'
  });

  logger.info('Tarea programada: Archivado de actividades');
  logger.info(`  Programacion: ${MODO_TESTING ? 'Cada 3 minutos' : 'Diariamente a la 1:00 AM'}`);

  // Tarea de limpieza de query logs
  cron.schedule(cronQueryLogs, async () => {
    await tareaLimpiarQueryLogs();
  }, {
    timezone: 'Europe/Madrid'
  });

  logger.info('Tarea programada: Limpieza de query logs');
  logger.info(`  Programacion: Diariamente a las 2:00 AM`);

  // Ejecutar inmediatamente si estamos en modo testing
  if (MODO_TESTING) {
    logger.info('Modo testing: Ejecutando tarea inmediatamente...');
    setTimeout(() => {
      tareaArchivarActividades();
    }, 15000);
  }

  logger.info('==================================================\n');
}

/**
 * Ejecutar tarea manualmente (para testing/admin)
 */
export async function ejecutarTareaManual(nombreTarea) {
  switch (nombreTarea) {
    case 'archivado_talleres':
      await tareaArchivarTalleres();
      break;
    case 'archivado_actividades':
      await tareaArchivarActividades();
      break;
    case 'limpieza_query_logs':
      await tareaLimpiarQueryLogs();
      break;
    default:
      throw new Error(`Tarea no encontrada: ${nombreTarea}`);
  }
}
