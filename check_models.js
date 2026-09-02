const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').find(l => l.startsWith('GEMINI_API_KEY='));
const apiKey = env ? env.split('=')[1].trim().replace(/^"|"$/g, '') : process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey });

ai.models.list().then(async m => {
  for await (let md of m) {
    console.log(md.name);
  }
}).catch(console.error);
