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

const browserUi = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Broker CSV Import Service</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f6f7f2;
        color: #171a1f;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          linear-gradient(135deg, rgba(35, 99, 92, 0.08), transparent 42%),
          linear-gradient(315deg, rgba(184, 82, 48, 0.1), transparent 36%),
          #f6f7f2;
      }

      main {
        width: min(960px, calc(100% - 32px));
        margin: 0 auto;
        padding: 48px 0;
      }

      header {
        margin-bottom: 28px;
      }

      h1 {
        margin: 0;
        font-size: clamp(2rem, 5vw, 4rem);
        line-height: 1;
        letter-spacing: 0;
      }

      .subtitle {
        max-width: 680px;
        margin: 14px 0 0;
        color: #4e5661;
        font-size: 1rem;
        line-height: 1.6;
      }

      .panel {
        display: grid;
        gap: 18px;
        padding: 22px;
        border: 1px solid #dfe3d5;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.82);
        box-shadow: 0 18px 60px rgba(23, 26, 31, 0.08);
      }

      form {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: center;
      }

      input[type="file"] {
        width: 100%;
        min-height: 44px;
        padding: 10px;
        border: 1px solid #cbd2c1;
        border-radius: 6px;
        background: #ffffff;
      }

      button {
        min-height: 44px;
        padding: 0 18px;
        border: 0;
        border-radius: 6px;
        background: #23635c;
        color: #ffffff;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      button:disabled {
        cursor: wait;
        opacity: 0.68;
      }

      .status {
        min-height: 24px;
        color: #4e5661;
        font-weight: 650;
      }

      pre {
        min-height: 260px;
        max-height: 520px;
        margin: 0;
        overflow: auto;
        padding: 18px;
        border-radius: 8px;
        background: #171a1f;
        color: #eff6ef;
        font-size: 0.92rem;
        line-height: 1.5;
      }

      .error {
        color: #b85230;
      }

      @media (max-width: 680px) {
        main {
          width: min(100% - 24px, 960px);
          padding: 28px 0;
        }

        form {
          grid-template-columns: 1fr;
        }

        button {
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Broker CSV Import</h1>
        <p class="subtitle">Upload a Zerodha or IBKR trade-history CSV and inspect the normalized trade payload returned by the HTTP service.</p>
      </header>

      <section class="panel" aria-label="CSV import">
        <form id="import-form">
          <input id="csv-file" name="file" type="file" accept=".csv,text/csv" required />
          <button type="submit">Import CSV</button>
        </form>
        <div id="status" class="status">Ready</div>
        <pre id="result">{}</pre>
      </section>
    </main>

    <script>
      const form = document.querySelector("#import-form");
      const fileInput = document.querySelector("#csv-file");
      const status = document.querySelector("#status");
      const result = document.querySelector("#result");
      const button = form.querySelector("button");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!fileInput.files.length) {
          status.textContent = "Choose a CSV file first.";
          status.classList.add("error");
          return;
        }

        const formData = new FormData();
        formData.append("file", fileInput.files[0]);

        button.disabled = true;
        status.textContent = "Importing...";
        status.classList.remove("error");
        result.textContent = "";

        try {
          const response = await fetch("/import", {
            method: "POST",
            body: formData,
          });
          const payload = await response.json();
          result.textContent = JSON.stringify(payload, null, 2);

          if (!response.ok) {
            status.textContent = "Import failed";
            status.classList.add("error");
            return;
          }

          status.textContent = "Imported " + payload.summary.valid + " of " + payload.summary.total + " rows";
        } catch (error) {
          status.textContent = error instanceof Error ? error.message : "Import failed";
          status.classList.add("error");
        } finally {
          button.disabled = false;
        }
      });
    </script>
  </body>
</html>`;

export function createApp(): express.Express {
  const app = express();

  app.get("/", (_request, response) => {
    response.type("html").send(browserUi);
  });

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
