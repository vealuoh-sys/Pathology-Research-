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
    console.log("llama-3.3 json mode success:", object);
  } catch(e) {
    console.error("llama-3.3 json mode failed:", e.message);
  }

  try {
    const { object } = await generateObject({
      model: groq("llama-3.1-8b-instant"),
      schema: z.object({ test: z.string() }),
      prompt: "say hi",
      // auto mode
    });
    console.log("llama-3.1-8b auto mode success:", object);
  } catch(e) {
    console.error("llama-3.1-8b auto mode failed:", e.message);
  }
}
run();
