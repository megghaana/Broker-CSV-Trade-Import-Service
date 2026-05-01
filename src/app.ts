import express from "express";
import multer from "multer";
import { importTrades, ImportError } from "./importService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

export function createApp(): express.Express {
  const app = express();

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.post("/import", upload.single("file"), (request, response, next) => {
    try {
      if (!request.file) {
        throw new ImportError("CSV file is required in multipart field 'file'");
      }

      const csvText = request.file.buffer.toString("utf8");
      const result = importTrades(csvText);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  // All 4 args required — Express identifies error handlers by arity
  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction
    ) => {
      if (error instanceof ImportError) {
        response.status(error.statusCode).json({ error: error.message });
        return;
      }

      if (error instanceof multer.MulterError) {
        response.status(400).json({ error: `File upload error: ${error.message}` });
        return;
      }

      const message =
        error instanceof Error ? error.message : "Unexpected import error";
      response.status(500).json({ error: message });
    }
  );

  return app;
}