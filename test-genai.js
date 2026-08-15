import { GoogleGenAI } from "@google/genai";
async function run() {
  const ai = new GoogleGenAI({});
  const models = await ai.models.list();
  for await (const m of models) {
    console.log(m.name);
  }
}
run();
