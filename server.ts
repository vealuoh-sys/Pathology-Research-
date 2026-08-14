import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Groq from "groq-sdk";

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  app.post("/api/generate", async (req, res) => {
    try {
      const { prompt, system } = req.body;
      const key = process.env.GROQ_API_KEY;
      
      console.log("Processing request with GROQ_API_KEY ending in:", key ? key.slice(-4) : "NONE");
      
      if (!key) {
        throw new Error("GROQ_API_KEY environment variable is required. Please set it in the AI Studio settings (Secrets panel).");
      }
      
      const groq = new Groq({ apiKey: key });
      const messages: any[] = [];
      
      if (system) {
        messages.push({ role: "system", content: system });
      }
      messages.push({ role: "user", content: prompt });

      const response = await groq.chat.completions.create({
        messages: messages,
        model: "llama-3.3-70b-versatile",
      });
      
      res.json({ text: response.choices[0]?.message?.content || "" });
    } catch (error: any) {
      console.error("Groq API Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
