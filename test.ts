import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'AIzaSyDuyccmjukAl4LhRcz8ExjVGlqElN6ydPQ' });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { text: "test" }
        ],
      },
    });
    console.log("Success");
  } catch (e) {
    console.error(e);
  }
}
test();
