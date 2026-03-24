import * as docDAO from "../DAO/tallerDocumentosDAO.js";
import logger from "../logger.js";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const CHUNK_DIR = join(tmpdir(), "reconecta-doc-chunks");
const UUID_RE   = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

mkdir(CHUNK_DIR, { recursive: true }).catch(() => {});

/** GET /api/talleres/:id/documentos — todos los autenticados */
export const getDocumentos = async (req, res, next) => {
  try {
    const docs = await docDAO.listarDocumentos(req.params.id);
    res.json(docs);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/talleres/:id/documentos/chunk
 * Body: { sessionId, index, total, nombre, data (base64) }
 * Cuando llega el último chunk ensambla el PDF y lo sube a Supabase Storage.
 */
export const subirDocumentoChunk = async (req, res, next) => {
  try {
    const tallerId = req.params.id;
    const { sessionId, index, total, nombre, data } = req.body;

    if (!UUID_RE.test(tallerId)) {
      return res.status(400).json({ message: "tallerId inválido" });
    }
    if (!sessionId || !UUID_RE.test(sessionId)) {
      return res.status(400).json({ message: "sessionId inválido (debe ser UUID)" });
    }
    if (typeof nombre !== "string" || nombre.trim().length === 0 || nombre.length > 200) {
      return res.status(400).json({ message: "nombre inválido" });
    }
    if (typeof index !== "number" || typeof total !== "number" ||
        index < 0 || total < 1 || total > 500 || index >= total) {
      return res.status(400).json({ message: "index o total inválidos" });
    }
    if (typeof data !== "string" || data.length === 0) {
      return res.status(400).json({ message: "data vacío" });
    }

    // Guardar chunk en disco
    const chunkPath = join(CHUNK_DIR, `${sessionId}_${index}`);
    await writeFile(chunkPath, data, "utf8");

    // Comprobar si todos los chunks han llegado
    const reads = await Promise.all(
      Array.from({ length: total }, (_, i) =>
        readFile(join(CHUNK_DIR, `${sessionId}_${i}`), "utf8").catch(() => null)
      )
    );

    const allPresent = reads.every((r) => r !== null);
    if (!allPresent) {
      const received = reads.filter((r) => r !== null).length;
      return res.json({ received, remaining: total - received });
    }

    // Ensamblar y limpiar temporales
    const buffer = Buffer.from(reads.join(""), "base64");
    const paths  = Array.from({ length: total }, (_, i) => join(CHUNK_DIR, `${sessionId}_${i}`));
    await Promise.all(paths.map((p) => unlink(p).catch(() => {})));

    const result = await docDAO.subirDocumento(tallerId, {
      nombre:    nombre.trim(),
      buffer,
      mimeType:  "application/pdf",
      subidoPor: req.user.id,
    });

    res.status(201).json(result);
  } catch (error) {
    logger.error(`[PDF CHUNK] Error: ${error.message}`);
    next(error);
  }
};

/** DELETE /api/talleres/:id/documentos/:docId — solo admin */
export const eliminarDocumento = async (req, res, next) => {
  try {
    await docDAO.eliminarDocumento(req.params.docId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
