import { z } from "zod";
import { generateObject } from "ai";
import { groq } from "@ai-sdk/groq";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  try {
    const { object } = await generateObject({
      model: groq("llama-3.3-70b-versatile"),
      schema: z.object({ test: z.string() }),
      prompt: "say hi",
      mode: 'json'
    });
    console.log("mode json success:", object);
  } catch(e) {
    console.error("mode json failed:", e.message);
  }
}
run();
