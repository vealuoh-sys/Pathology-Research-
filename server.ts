import { z } from "zod";
import { generateText, generateObject, streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { groq as groqProvider } from "@ai-sdk/groq";
import { GoogleGenAI } from "@google/genai";
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
      const { prompt, system, webSearch, highThinking, schemaId } = req.body;
      const geminiKey = process.env.GEMINI_API_KEY;
      const groqKey = process.env.GROQ_API_KEY;
      
      let providerModel;
      let isGroq = false;
      
      // Select Provider and Model
      if (geminiKey && (webSearch || highThinking || schemaId === 'screening-funnel' || !groqKey)) {
        let modelName = "gemini-3.5-flash"; // Fixed to valid models
        
        if (webSearch) {
          modelName = "gemini-3.5-flash"; // Vercel AI SDK Google provider handles search via tools, but for this app just use a valid model.
        } else if (highThinking) {
          modelName = "gemini-3.5-flash"; // Use 2.5 pro for "high thinking"
        }
        
        // Validate against SDK's supported models
        const googleGenAI = new GoogleGenAI({ apiKey: geminiKey });
        const models = await googleGenAI.models.list();
        const supportedModels = [];
        for await (const m of models) {
          supportedModels.push(m.name.replace('models/', ''));
        }
        
        if (!supportedModels.includes(modelName)) {
          throw new Error(`Invalid model name requested: ${modelName}. Supported models include: ${supportedModels.slice(0, 5).join(', ')}...`);
        }
        
        console.log(`Trying Gemini API (${modelName})...`);
        const googleProvider = createGoogleGenerativeAI({ apiKey: geminiKey });
        providerModel = googleProvider(modelName);
      } else {
        if (!groqKey) {
          throw new Error("GROQ_API_KEY environment variable is required if Gemini is not configured.");
        }
        console.log("Processing request with GROQ_API_KEY ending in:", groqKey.slice(-4));
        providerModel = groqProvider("llama-3.3-70b-versatile");
        isGroq = true;
      }
      
      let responseText = "";
      
      async function attemptGeneration(currentProviderModel, currentIsGroq) {
        let textResult = "";
        if (currentIsGroq && schemaId) {
          let schemaInstruction = "\n\nIMPORTANT: You must respond ONLY with raw JSON. Do not use markdown blocks. Return JSON matching this structure:\n";
          if (schemaId === 'gap-synthesis') {
            schemaInstruction += "{ saturation: string, justification: string, gaps: [{ text: string, provenance: [{uid: string, quote: string}] }] }";
          } else if (schemaId === 'screening-funnel') {
            schemaInstruction += "[{ uid: string, included: boolean, reason: string }]";
          } else if (schemaId === 'literature-reviewer') {
            schemaInstruction += "{ sufficient: boolean, reasoning: string, missingAspects: [string], suggestedExclusionsToReinclude: [string] }";
          } else if (schemaId === 'refinement-pass') {
            schemaInstruction += "[{ issue: string, quote: string, type: 'citation'|'methodology'|'criteria'|'limitation'|'bias'|'other', severity: 'high'|'medium'|'low', section: string }]";
          }
          
          const { text } = await generateText({
            model: currentProviderModel,
            system,
            prompt: prompt + schemaInstruction
          });
          
          textResult = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        } else {
          if (schemaId === 'gap-synthesis') {
            const { object } = await generateObject({
              model: currentProviderModel,
              system,
              prompt,
              schema: z.object({
                saturation: z.string(),
                justification: z.string(),
                gaps: z.array(z.object({
                  text: z.string(),
                  provenance: z.array(z.object({
                    uid: z.string(),
                    quote: z.string()
                  }))
                }))
              })
            });
            textResult = JSON.stringify(object);
          } else if (schemaId === 'screening-funnel') {
            const { object } = await generateObject({
              model: currentProviderModel,
              system,
              prompt,
              schema: z.array(z.object({
                uid: z.string(),
                included: z.boolean(),
                reason: z.string()
              }))
            });
            textResult = JSON.stringify(object);
          } else if (schemaId === 'literature-reviewer') {
            const { object } = await generateObject({
              model: currentProviderModel,
              system,
              prompt,
              schema: z.object({
                sufficient: z.boolean(),
                reasoning: z.string(),
                missingAspects: z.array(z.string()).optional(),
                suggestedExclusionsToReinclude: z.array(z.string()).optional()
              })
            });
            textResult = JSON.stringify(object);
          } else if (schemaId === 'refinement-pass') {
            const { object } = await generateObject({
              model: currentProviderModel,
              system,
              prompt,
              schema: z.array(z.object({
                issue: z.string(),
                quote: z.string(),
                type: z.enum(['citation', 'methodology', 'criteria', 'limitation', 'bias', 'other']),
                severity: z.enum(['high', 'medium', 'low']),
                section: z.string()
              }))
            });
            textResult = JSON.stringify(object);
          } else {
            const { text } = await generateText({
              model: currentProviderModel,
              system,
              prompt
            });
            textResult = text;
          }
        }
        return textResult;
      }

      try {
        responseText = await attemptGeneration(providerModel, isGroq);
      } catch (e: any) {
        console.log(`[Primary Provider Error]: ${e.message}`);
        if (e.message && (e.message.toLowerCase().includes("not found") || e.message.toLowerCase().includes("invalid model"))) {
            throw new Error("Invalid model name provided: " + e.message);
        }
        if (false && !isGroq && groqKey) {
           console.log(`[Fallback] Primary provider failed (likely quota). Routing request to Groq...`);
           const fallbackModel = groqProvider("llama-3.3-70b-versatile");
           responseText = await attemptGeneration(fallbackModel, true);
        } else {
           throw e;
        }
      }

      
      return res.json({ text: responseText });
    } catch (error: any) {
      console.error("API Error (Properly surfaced):", error.message || error);
      res.status(500).json({ error: error.message || "Provider call failed" });
    }
  });

  

  
  app.post("/api/generate-style", async (req, res) => {
    try {
      const { prompt } = req.body;
      const groqKey = process.env.GROQ_API_KEY;
      
      let providerModel;
      if (groqKey) {
        providerModel = groqProvider("llama-3.3-70b-versatile");
      } else {
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) throw new Error("GEMINI_API_KEY missing");
        const googleProvider = createGoogleGenerativeAI({ apiKey: geminiKey });
        providerModel = googleProvider("gemini-3.5-flash");
      }
      
      const result = streamText({
        model: providerModel,
        prompt: prompt,
        system: "You are an expert academic writing assistant helping the user draft and refine a medical research manuscript. Keep additions concise, academic, and directly related to the surrounding text. Do not repeat the prompt. Only output the text that should be inserted."
      });
      
      result.pipeTextStreamToResponse(res);
    } catch (e) {
      console.error(e);
      res.status(500).send(e.message);
    }
  });

  app.post("/api/verify-doi", async (req, res) => {
    try {
      const { doi } = req.body;
      if (!doi) throw new Error("DOI is required");
      
      const cleanDoi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
      const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`);
      
      if (!response.ok) {
        return res.json({ verified: false, error: "Not found in CrossRef" });
      }
      
      const data = await response.json();
      const work = data.message;
      
      res.json({
        verified: true,
        title: work.title?.[0],
        authors: work.author?.map((a: any) => `${a.given} ${a.family}`).join(', '),
        year: work.created?.['date-parts']?.[0]?.[0] || work.issued?.['date-parts']?.[0]?.[0]
      });
    } catch (error: any) {
      console.error("DOI Verification Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/literature-search", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) throw new Error("Query is required");

      const [pubmedRes, oaRes] = await Promise.allSettled([
        fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=100`),
        fetch(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=100`)
      ]);

      let docs: any[] = [];
      let initialCount = 0;

      // Helper for OpenAlex Abstract
      function reconstructAbstract(invertedIndex: any) {
        if (!invertedIndex) return '';
        const entries = Object.entries(invertedIndex);
        let maxIndex = 0;
        for (const [word, positions] of entries) {
          for (const pos of positions as number[]) {
            if (pos > maxIndex) maxIndex = pos;
          }
        }
        const words = new Array(maxIndex + 1).fill('');
        for (const [word, positions] of entries) {
          for (const pos of positions as number[]) {
            words[pos] = word;
          }
        }
        return words.join(' ').replace(/\s+/g, ' ').trim();
      }

      if (pubmedRes.status === 'fulfilled') {
        const searchData = await pubmedRes.value.json();
        if (searchData.esearchresult?.idlist?.length > 0) {
          initialCount += searchData.esearchresult.idlist.length;
          const ids = searchData.esearchresult.idlist.join(',');
          const [summaryRes, xmlRes] = await Promise.all([
            fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids}&retmode=json`),
            fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids}&retmode=xml`)
          ]);
          const summaryData = await summaryRes.json();
          const xmlText = await xmlRes.text();
          
          const abstracts: Record<string, string> = {};
          const articles = xmlText.split(/<PubmedArticle>|<PubmedBookArticle>/).slice(1);
          for (const article of articles) {
            const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/);
            if (!pmidMatch) continue;
            const pmid = pmidMatch[1];
            const abstractLines = [];
            const abstractMatches = article.matchAll(/<AbstractText[^>]*>(.*?)<\/AbstractText>/g);
            for (const match of abstractMatches) {
              abstractLines.push(match[1]);
            }
            abstracts[pmid] = abstractLines.join(' ');
          }

          searchData.esearchresult.idlist.forEach((id: string) => {
            const article = summaryData.result[id];
            if (!article) return;
            
            // Try to find DOI in articleids
            let doi = '';
            if (article.articleids) {
              const doiObj = article.articleids.find((aid: any) => aid.idtype === 'doi');
              if (doiObj) doi = doiObj.value;
            }

            docs.push({
              title: article.title,
              pubdate: article.pubdate || 'Unknown',
              source: article.source || 'PubMed',
              uid: id,
              url: `https://pubmed.ncbi.nlm.nih.gov/${id}`,
              origin: 'PubMed',
              abstract: abstracts[id] || '',
              doi: doi,
              citations: null // PubMed eutils doesn't easily return citation counts
            });
          });
        }
      }

      if (oaRes.status === 'fulfilled') {
        const oaData = await oaRes.value.json();
        initialCount += (oaData.results || []).length;
        (oaData.results || []).forEach((w: any) => {
          docs.push({
            title: w.display_name,
            pubdate: w.publication_date || w.publication_year || 'Unknown',
            source: w.host_venue?.display_name || w.primary_location?.source?.display_name || 'OpenAlex',
            uid: w.id,
            url: w.id,
            origin: 'OpenAlex',
            abstract: reconstructAbstract(w.abstract_inverted_index),
            doi: w.doi ? w.doi.replace('https://doi.org/', '') : '',
            citations: w.cited_by_count
          });
        });
      }

      // Deduplicate roughly by DOI first, then title
      const uniqueDocs: any[] = [];
      const seenDois = new Set();
      const seenTitles = new Set();

      for (const d of docs) {
        if (!d.title) continue;
        const normalizedTitle = d.title.toLowerCase().trim();
        
        let isDuplicate = false;
        if (d.doi) {
          const normalizedDoi = d.doi.toLowerCase().trim();
          if (seenDois.has(normalizedDoi)) {
            isDuplicate = true;
          } else {
            seenDois.add(normalizedDoi);
          }
        }
        
        if (!isDuplicate) {
          if (seenTitles.has(normalizedTitle)) {
            isDuplicate = true;
          } else {
            seenTitles.add(normalizedTitle);
          }
        }
        
        if (!isDuplicate) {
          uniqueDocs.push(d);
        }
      }

      res.json({ 
        results: uniqueDocs,
        counts: {
          initial: initialCount,
          deduplicated: uniqueDocs.length
        }
      }); // Return all combined
    } catch (error: any) {
      console.error("Literature Search Error:", error);
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
