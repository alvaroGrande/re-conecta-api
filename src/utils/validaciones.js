/**
 * Utilidades de validación reutilizables para datos de usuario.
 */

const TABLA_LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';

/**
 * Valida el formato de un email.
 * @param {string} email
 * @returns {boolean}
 */
export function validarEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Valida un DNI o NIE español mediante el algoritmo de letra de control.
 * Campo opcional: si viene vacío, se considera válido (la obligatoriedad
 * se comprueba aparte).
 * @param {string} valor
 * @returns {boolean}
 */
export function validarDNI(valor) {
  if (!valor) return true;
  const limpio = String(valor).trim().toUpperCase().replace(/[\s-]/g, '');

  const matchDNI = limpio.match(/^(\d{8})([A-Z])$/);
  const matchNIE = limpio.match(/^([XYZ])(\d{7})([A-Z])$/);

  let numero;
  let letra;

  if (matchDNI) {
    numero = parseInt(matchDNI[1], 10);
    letra = matchDNI[2];
  } else if (matchNIE) {
    const prefijos = { X: '0', Y: '1', Z: '2' };
    numero = parseInt(prefijos[matchNIE[1]] + matchNIE[2], 10);
    letra = matchNIE[3];
  } else {
    return false;
  }

  return TABLA_LETRAS_DNI[numero % 23] === letra;
}

/**
 * Valida un teléfono español (fijo o móvil), con o sin prefijo +34.
 * Campo opcional: si viene vacío, se considera válido.
 * @param {string} telefono
 * @returns {boolean}
 */
export function validarTelefono(telefono) {
  if (!telefono) return true;
  const limpio = String(telefono).trim().replace(/[\s-]/g, '');
  return /^(\+34|0034)?[6789]\d{8}$/.test(limpio);
}

/**
 * Valida que una fecha (string) sea una fecha real y no esté en el futuro.
 * Campo opcional: si viene vacío, se considera válido.
 * @param {string} fecha
 * @returns {boolean}
 */
export function validarFechaNacimiento(fecha) {
  if (!fecha) return true;
  const timestamp = Date.parse(fecha);
  if (Number.isNaN(timestamp)) return false;
  return timestamp <= Date.now();
}
