// Datos de ejemplo
let talleres = [
  {
    id: 1,
    tipo: 'Online',
    variante: 'Gratis',
    titulo: 'Vue 3 Avanzado',
    descripcion: 'Fecha: 20/09/2025 | Duración: 2h | Aforo: 20 personas'
  },
  {
    id: 2,
    tipo: 'Online',
    variante: 'Pago',
    titulo: 'Introducción a Figma',
    descripcion: 'Fecha: 22/09/2025 | Duración: 1.5h | Aforo: 15 personas'
  },
  {
    id: 3,
    tipo: 'Presencial',
    variante: 'Pago',
    titulo: 'Redes Sociales Efectivas',
    descripcion: 'Fecha: 25/09/2025 | Duración: 2h | Aforo: 25 personas'
  },
  {
    id: 4,
    tipo: 'Presencial',
    variante: 'Gratis',
    titulo: 'Redes Sociales Efectivas Redes Sociales',
    descripcion: 'Fecha: 25/09/2025 | Duración: 2h | Aforo: 25 personas'
  },
  {
    id: 5,
    tipo: 'Presencial',
    variante: 'Gratis',
    titulo: 'Redes Sociales Efectivas',
    descripcion: 'Fecha: 25/09/2025 | Duración: 2h | Aforo: 25 personas'
  }
];

import {supabase} from "./connection.js";
export const obtenerTalleres = async () => {
  const { data, error } = await supabase
  .from('talleres')
  .select('*')
//   .eq('activo', 1)   // filtra solo activos
  .order('fecha', { ascending: true })
  if((error)) throw new Error(error.message);
  return data;
};

export const obtenerTallerPorId = async (id) => {
   const { data, error } = await supabase
    .from('talleres')
    .select('*')
    .eq('id', id)
    .single()  // devuelve un único objeto en vez de array

  if (error) throw error
  return data
};

export const crearTaller = async (taller) => {
    console.log(taller);
  const { data, error } = await supabase
    .from('talleres')
    .insert([taller])  // recibe un objeto o array de objetos
    console.log(error);
  if (error) throw new Error("No se ha podido crear el taller: " + error.message);
  return data
};

export const activarTaller = async (id) => {
  const { data, error } = await supabase
    .from('talleres')
    .update({ activo: 1 })
    .eq('id', id)
    .select()  // devuelve el objeto actualizado
    if (error) throw new Error("No se ha podido activar el taller: " + error.message);
    return data;  // devuelve el primer objeto del array
};
export const desactivarTaller = async (id) => {
  const { data, error } = await supabase
    .from('talleres')
    .update({ activo: 0 })
    .eq('id', id)
    .select()  // devuelve el objeto actualizado
    if (error) throw new Error("No se ha podido desactivar el taller: " + error.message);
    return data;  // devuelve el primer objeto del array
};

export const inscribirTaller = async (id) => {
  const { data: currentData, error: selectError } = await supabase
      .from('talleres')
      .select('inscritos')
      .eq('id', id)
      .single();
    
    if (selectError) throw selectError;
    
    // Luego actualizar con el nuevo valor
    const { data, error } = await supabase
      .from('talleres')
      .update({ inscritos: currentData.inscritos + 1 })
      .eq('id', id)
      .select();

    
    const inscritos = currentData.inscritos + 1;
    
    if (error) throw new Error("No se ha podido inscribir el taller: " + error.message);
    
    return inscritos;
}