// Zero-dependency Local Server for Couples Language Learning App
const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 9100;

// Load .env variables manually to avoid external dependencies
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      let val = parts.slice(1).join('=').trim();
      // Strip outer quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

// Helper: Call Gemini API using https module
function callGemini(prompt, apiKey, callback) {
  const requestBody = JSON.stringify({
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  });

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody)
    }
  };

  const req = https.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => { responseData += chunk; });
    res.on('end', () => {
      if (res.statusCode !== 200) {
        callback(new Error(`API responded with status: ${res.statusCode}. Body: ${responseData}`));
      } else {
        callback(null, responseData);
      }
    });
  });

  req.on('error', (e) => { callback(e); });
  req.write(requestBody);
  req.end();
}

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gemini-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let reqUrl = req.url;
  if (reqUrl.includes('?')) {
    reqUrl = reqUrl.substring(0, reqUrl.indexOf('?'));
  }

  // Strip gateway proxies
  if (reqUrl.startsWith('/languages/')) {
    reqUrl = reqUrl.substring(10);
  } else if (reqUrl === '/languages') {
    res.writeHead(301, { 'Location': '/languages/' });
    res.end();
    return;
  }

  if (reqUrl.startsWith('/proxy/languages/')) {
    reqUrl = reqUrl.substring(16);
  } else if (reqUrl === '/proxy/languages') {
    res.writeHead(301, { 'Location': '/proxy/languages/' });
    res.end();
    return;
  }

  const historyFilePath = path.join(__dirname, 'history.json');

  // API Route: GET /api/history
  if (req.method === 'GET' && reqUrl === '/api/history') {
    if (fs.existsSync(historyFilePath)) {
      fs.readFile(historyFilePath, 'utf8', (err, data) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to read history log.' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(data);
        }
      });
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
    }
    return;
  }

  // API Route: POST /api/history
  if (req.method === 'POST' && reqUrl === '/api/history') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const newRecord = JSON.parse(body);
        let history = [];
        if (fs.existsSync(historyFilePath)) {
          try {
            history = JSON.parse(fs.readFileSync(historyFilePath, 'utf8'));
          } catch (e) {
            history = [];
          }
        }
        
        newRecord.id = Date.now().toString();
        newRecord.timestamp = new Date().toISOString();
        history.unshift(newRecord);
        
        // Limit history records
        if (history.length > 100) history.pop();

        fs.writeFile(historyFilePath, JSON.stringify(history, null, 2), 'utf8', (err) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save practice record.' }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, record: newRecord }));
          }
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // API Route: POST /api/generate
  if (req.method === 'POST' && reqUrl === '/api/generate') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const params = JSON.parse(body);
        const { mode, level, languagePair, partnerA, partnerB } = params;

        // Resolve API key: check header, then body, then server process.env
        const apiKey = req.headers['x-gemini-key'] || params.apiKey || process.env.GEMINI_API_KEY;

        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Gemini API Key is missing. Please configure it in your settings or .env file.' }));
          return;
        }

        // Parse Language pair
        let sourceLang = "German";
        let targetLang = "Swedish";
        if (languagePair === "swedish-german") {
          sourceLang = "Swedish";
          targetLang = "German";
        } else if (languagePair === "italian-english") {
          sourceLang = "Italian";
          targetLang = "English";
        }

        let modePrompt = "";
        if (mode === "story") {
          modePrompt = `Generate a Pimsleur-style conversational scenario/story for a couple (${partnerA || 'Partner A'} and ${partnerB || 'Partner B'}) practicing their ${targetLang} (with ${sourceLang} translation helper).
Difficulty level: ${level} (CEFR standard).
The topic must feel organic, warm, and slightly contemplative (e.g., sharing a recipe, discussing a book, walking in a misty park, plans for an evening together, reflecting on a trip).
Respond STRICTLY in JSON format with the following structure:
{
  "title": "A short poetic or editorial title in ${targetLang}",
  "scenario": "A brief setup description in ${sourceLang} explaining what the couple is doing.",
  "dialogue": [
    { "speaker": "${partnerA || 'Partner A'}", "text": "A line in ${targetLang}", "translation": "The line translated to ${sourceLang}" },
    { "speaker": "${partnerB || 'Partner B'}", "text": "A line in ${targetLang}", "translation": "The line translated to ${sourceLang}" }
    // Add 4-6 lines of alternating conversation appropriate for ${level} level. Keep sentences natural.
  ],
  "comprehension": [
    {
      "question": "A comprehension question about the dialogue in ${sourceLang}",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "answerIndex": 0, // 0-based index of correct option
      "explanation": "A gentle philosophical explanation or vocabulary note in ${sourceLang}"
    }
    // Exactly 3 questions
  ]
}`;
        } else if (mode === "vocabulary") {
          modePrompt = `Generate 5 vocabulary test questions for learning ${targetLang} vocabulary from ${sourceLang}.
Difficulty level: ${level} (CEFR standard).
Themes should be interesting, humanist, or everyday conversational.
Respond STRICTLY in JSON format with this structure:
{
  "questions": [
    {
      "type": "multiple-choice", // or "fill-in-the-blank"
      "word": "The word in ${targetLang}",
      "definition": "The translation or definition in ${sourceLang}",
      "sentence": "An elegant example sentence in ${targetLang} using the word (use ___ if fill-in-the-blank)",
      "sentenceTranslation": "The example sentence translated into ${sourceLang}",
      "options": ["Option A", "Option B", "Option C", "Option D"], // For multiple-choice, include the correct word/phrase and 3 distractors. For fill-in-the-blank, options should be words that could fit syntactically.
      "correctAnswer": "The exact correct answer (must match one of the options)",
      "explanation": "An interesting etymological, cultural, or grammar note about the word in ${sourceLang}"
    }
    // Exactly 5 objects
  ]
}`;
        } else if (mode === "listening") {
          modePrompt = `Generate 3 listening comprehension exercises for learning ${targetLang} from ${sourceLang}.
Difficulty level: ${level}.
These are meant to be read aloud by browser Text-to-Speech (TTS), so make the phrases clear, standard, and interesting.
Respond STRICTLY in JSON format with this structure:
{
  "exercises": [
    {
      "audioPhrase": "A full sentence or short paragraph in ${targetLang} to be read aloud.",
      "translation": "The translation in ${sourceLang}",
      "question": "A listening comprehension question related to the phrase, written in ${sourceLang}",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answerIndex": 0, // Index of correct option
      "explanation": "A helpful tips or grammar details note in ${sourceLang}"
    }
    // Exactly 3 objects
  ]
}`;
        } else if (mode === "reading") {
          modePrompt = `Generate a reading comprehension task in ${targetLang} with translations and questions in ${sourceLang}.
Difficulty level: ${level}.
Make it an editorial essay style passage (like a short excerpt from a philosophical journal, discussing art, mindfulness, relationships, nature, or time, 100-180 words).
Respond STRICTLY in JSON format with this structure:
{
  "title": "Title in ${targetLang}",
  "passage": "The reading passage in ${targetLang}",
  "translation": "Paragraph by paragraph translation of the passage into ${sourceLang}",
  "vocabularyNotes": [
    { "term": "Key term in ${targetLang}", "meaning": "Nuanced meaning/translation in ${sourceLang}" }
  ],
  "questions": [
    {
      "question": "Comprehension question in ${sourceLang}",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answerIndex": 0,
      "explanation": "A thoughtful explanation referring back to the text."
    }
    // Exactly 3 questions
  ]
}`;
        } else if (mode === "conversation") {
          modePrompt = `Generate a couples conversation practice prompt for learning ${targetLang} from ${sourceLang}.
Difficulty level: ${level}.
Setup a scenario where the partners must speak or write answers to interact with each other.
Respond STRICTLY in JSON format with this structure:
{
  "topic": "Topic in ${sourceLang}",
  "scenario": "A descriptive scenario setup in ${sourceLang} (e.g. Discussing what makes a home feel comfortable or sharing childhood memories)",
  "partnerAPrompt": "Specific instructions or starter questions for ${partnerA || 'Partner A'} in ${sourceLang}",
  "partnerBPrompt": "Specific instructions or starter questions for ${partnerB || 'Partner B'} in ${sourceLang}",
  "helperVocabulary": [
    { "phrase": "Useful phrase in ${targetLang}", "translation": "Translation in ${sourceLang}" }
  ],
  "starterPhrases": [
    "A couple of starter sentence openings in ${targetLang} to help them begin writing"
  ]
}`;
        }

        const systemPrompt = `You are a linguist and designer of a highly polished, editorial language learning curriculum. 
Your tone is thoughtful, contemplative, and warm, like a designed philosophy journal.
Do not output markdown code blocks, just raw JSON. The response MUST be valid JSON matching the requested structure.`;

        const fullPrompt = `${systemPrompt}\n\nTask:\n${modePrompt}`;

        callGemini(fullPrompt, apiKey, (err, geminiRes) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Gemini API call failed', details: err.message }));
          } else {
            try {
              const geminiData = JSON.parse(geminiRes);
              if (!geminiData.candidates || geminiData.candidates.length === 0) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Gemini returned empty results', raw: geminiData }));
                return;
              }
              let textContent = geminiData.candidates[0].content.parts[0].text.trim();
              
              // Clean codeblock markers if generated
              if (textContent.startsWith('```json')) {
                textContent = textContent.substring(7);
              }
              if (textContent.startsWith('```')) {
                textContent = textContent.substring(3);
              }
              if (textContent.endsWith('```')) {
                textContent = textContent.substring(0, textContent.length - 3);
              }
              
              const exerciseObj = JSON.parse(textContent.trim());
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, data: exerciseObj }));
            } catch (parseErr) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to parse Gemini response as JSON', raw: geminiRes, errorDetails: parseErr.message }));
            }
          }
        });

      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // API Route: POST /api/evaluate
  if (req.method === 'POST' && reqUrl === '/api/evaluate') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const params = JSON.parse(body);
        const { prompt, partnerResponse, partnerName, languagePair, level } = params;
        const apiKey = req.headers['x-gemini-key'] || params.apiKey || process.env.GEMINI_API_KEY;

        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Gemini API Key is missing.' }));
          return;
        }

        let sourceLang = "German";
        let targetLang = "Swedish";
        if (languagePair === "swedish-german") {
          sourceLang = "Swedish";
          targetLang = "German";
        } else if (languagePair === "italian-english") {
          sourceLang = "Italian";
          targetLang = "English";
        }

        const evaluationPrompt = `You are a thoughtful language tutor. Analyze the following written response by ${partnerName || 'Partner'} who is learning ${targetLang} (with native language ${sourceLang}) at level ${level}.
Response to evaluate: "${partnerResponse}"
Context/Task: "${prompt}"

Provide a constructive critique in ${sourceLang}. Use a warm, encouraging, editorial tone. Point out spelling, grammar, or word choice issues, and explain why.
Provide a clean grammatically correct version of the response in ${targetLang}.
Check if the response is generally correct/understandable.

Respond STRICTLY in JSON format with this structure:
{
  "isCorrect": true, // boolean, if it is mostly understandable and matches the level
  "correctedText": "The exact grammatically perfect and natural version of the response in ${targetLang}",
  "feedback": "A short paragraph in ${sourceLang} explaining what was good, what can be improved, and some interesting vocabulary or grammar details.",
  "suggestions": [
    "A specific alternative phrase or tip 1",
    "A specific alternative phrase or tip 2"
  ]
}`;

        callGemini(evaluationPrompt, apiKey, (err, geminiRes) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Gemini Evaluation failed', details: err.message }));
          } else {
            try {
              const geminiData = JSON.parse(geminiRes);
              if (!geminiData.candidates || geminiData.candidates.length === 0) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Gemini returned empty results', raw: geminiData }));
                return;
              }
              let textContent = geminiData.candidates[0].content.parts[0].text.trim();
              if (textContent.startsWith('```json')) textContent = textContent.substring(7);
              if (textContent.startsWith('```')) textContent = textContent.substring(3);
              if (textContent.endsWith('```')) textContent = textContent.substring(0, textContent.length - 3);

              const evalObj = JSON.parse(textContent.trim());
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, data: evalObj }));
            } catch (parseErr) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to parse evaluation response', raw: geminiRes }));
            }
          }
        });

      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // Static file server
  let servePath = reqUrl === '/' || reqUrl === '' ? '/index.html' : reqUrl;
  const filePath = path.join(__dirname, servePath);

  // Prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      // Disable cache for active local dev
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[Languages App] Running successfully at http://localhost:${PORT}`);
});
