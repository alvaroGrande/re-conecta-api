import { supabase } from "./connection.js";
import logger from "../logger.js";
import { executeWithTiming } from "../utils/queryLogger.js";

export const listarDocumentos = async (tallerId) => {
  return executeWithTiming("listarDocumentos", async () => {
    const { data, error } = await supabase
      .from("taller_documentos")
      .select("id, nombre, url, tamano, created_at")
      .eq("taller_id", tallerId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
};

export const subirDocumento = async (tallerId, { nombre, buffer, mimeType, subidoPor }) => {
  return executeWithTiming("subirDocumento", async () => {
    // Sanitizar nombre para la ruta de storage (solo chars seguros)
    const safeName = nombre.replace(/[^\w.\-\s]/g, "_").slice(0, 100);
    const ruta = `talleres/${tallerId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("taller-docs")
      .upload(ruta, buffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
      if (uploadError.message.includes("Bucket not found")) {
        throw new Error(
          "El bucket 'taller-docs' no existe. Créalo en Supabase Storage > New bucket > 'taller-docs' (Public: enabled)."
        );
      }
      throw new Error("Error al subir PDF: " + uploadError.message);
    }

    const { data: { publicUrl } } = supabase.storage
      .from("taller-docs")
      .getPublicUrl(ruta);

    const { data, error } = await supabase
      .from("taller_documentos")
      .insert({ taller_id: tallerId, nombre, url: publicUrl, ruta, tamano: buffer.length, subido_por: subidoPor })
      .select("id, nombre, url, tamano, created_at")
      .single();

    if (error) throw new Error(error.message);
    return data;
  });
};

export const eliminarDocumento = async (docId) => {
  return executeWithTiming("eliminarDocumento", async () => {
    const { data: doc, error: getErr } = await supabase
      .from("taller_documentos")
      .select("ruta")
      .eq("id", docId)
      .single();

    if (getErr) throw new Error("Documento no encontrado: " + getErr.message);

    // Eliminar del storage (no fatal si ya no existe)
    await supabase.storage
      .from("taller-docs")
      .remove([doc.ruta])
      .catch((e) => logger.warn(`No se pudo eliminar del storage: ${e.message}`));

    const { error } = await supabase
      .from("taller_documentos")
      .delete()
      .eq("id", docId);

    if (error) throw new Error(error.message);
  });
};
