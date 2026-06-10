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

  const settingsFilePath = path.join(__dirname, 'settings.json');

  // API Route: GET /api/settings
  if (req.method === 'GET' && reqUrl === '/api/settings') {
    if (fs.existsSync(settingsFilePath)) {
      fs.readFile(settingsFilePath, 'utf8', (err, data) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to read settings.' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(data);
        }
      });
    } else {
      const defaultSettings = {
        partnerA: "",
        partnerB: "",
        languagePair: "german-swedish",
        level: "B2",
        apiKey: "",
        currentMode: "story",
        activeExercises: {
          story: null,
          vocabulary: null,
          listening: null,
          reading: null,
          conversation: null
        }
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(defaultSettings));
    }
    return;
  }

  // API Route: POST /api/settings
  if (req.method === 'POST' && reqUrl === '/api/settings') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const newSettings = JSON.parse(body);
        let currentSettings = {
          partnerA: "",
          partnerB: "",
          languagePair: "german-swedish",
          level: "B2",
          apiKey: "",
          currentMode: "story",
          activeExercises: {
            story: null,
            vocabulary: null,
            listening: null,
            reading: null,
            conversation: null
          }
        };

        if (fs.existsSync(settingsFilePath)) {
          try {
            currentSettings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
          } catch (e) {
            // keep defaults
          }
        }

        // Merge settings
        const updatedSettings = { ...currentSettings, ...newSettings };

        fs.writeFile(settingsFilePath, JSON.stringify(updatedSettings, null, 2), 'utf8', (err) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save settings.' }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, settings: updatedSettings }));
          }
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
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
        const { mode, level, languagePair, partnerA, partnerB, theme, historyContext, learnerName, guideName, difficultWords } = params;

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
          modePrompt = `Generate exactly 20 vocabulary test questions for learning ${targetLang} vocabulary from ${sourceLang}.
Difficulty level: ${level} (CEFR standard).
Themes should be interesting, humanist, or everyday conversational.
Ensure that all 20 vocabulary words are unique (do not repeat any target words).
Respond STRICTLY in JSON format with this structure:
{
  "questions": [
    {
      "type": "fill-in-the-blank",
      "word": "The word in ${targetLang}",
      "definition": "The translation or definition in ${sourceLang}",
      "sentence": "An elegant example sentence in ${targetLang} using the word (use ___ where the word should be)",
      "sentenceTranslation": "The example sentence translated into ${sourceLang}",
      "options": ["Option A", "Option B", "Option C", "Option D"], // Include the correct target word and 3 distractors that make grammatical sense.
      "correctAnswer": "The exact correct answer (must match the correct target word and one of the options)",
      "explanation": "An interesting etymological, cultural, or grammar note about the word in ${sourceLang}"
    }
    // Exactly 20 objects
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
Make it a real, funny, and engaging everyday story involving a couple (e.g., a humorous miscommunication, a funny cooking disaster, a comical pet scenario, or a silly daily life incident, 100-180 words).
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
          modePrompt = `Generate an interactive couples conversation roleplay for learning ${targetLang} from ${sourceLang}.
Difficulty level: ${level} (CEFR standard).
The roleplay must be structured so that ${guideName || 'Partner B'} plays the role of the Guide (Expert speaker) who holds the phone, and ${learnerName || 'Partner A'} is the Learner.
Create a scenario where ${guideName || 'Partner B'} prompts or asks questions to ${learnerName || 'Partner A'} in ${targetLang}, and ${learnerName || 'Partner A'} has to verbally respond in ${targetLang} to complete specific tasks.
The topic must feel organic, warm, and relational (e.g., shopping at a market, planning an outing, ordering in a local cafe).
Respond STRICTLY in JSON format with this structure:
{
  "topic": "Topic name in ${targetLang} (with translation in ${sourceLang} in parentheses)",
  "scenario": "Detailed scenario setup in ${targetLang} explaining what role each partner plays. ${guideName || 'Partner B'} is playing [role] and ${learnerName || 'Partner A'} is playing [role] (include translation in ${sourceLang} in parentheses).",
  "learnerRole": "The role the Learner plays in ${targetLang} (with translation in ${sourceLang} in parentheses)",
  "guideRole": "The role the Guide plays in ${targetLang} (with translation in ${sourceLang} in parentheses)",
  "steps": [
    {
      "guideAction": "Instructions for ${guideName || 'Partner B'} on what to say or ask in ${targetLang} (include a translation in ${sourceLang} in parentheses)",
      "learnerTask": "Instructions for what ${learnerName || 'Partner A'} has to respond with or accomplish in ${targetLang} (include a translation in ${sourceLang} in parentheses)",
      "tips": [
        "A useful word or sentence fragment in ${targetLang} with translation in ${sourceLang} in parentheses that the guide can suggest if the learner gets stuck"
        // Generate exactly 2-3 useful words/phrases for this step
      ]
    }
    // Generate exactly 3 steps in logical timeline order (beginning, middle, conclusion of the roleplay)
  ]
}`;
        }

        let themeInstruction = "";
        if (theme && theme !== "random") {
          themeInstruction = `\n\nCRITICAL THEME CONSTRAINT: The exercise topic, scenario, and contents MUST strictly revolve around the theme: "${theme}".`;
        }

        let historyInstruction = "";
        if (historyContext) {
          const { pastWords, pastTitles, pastTopics } = historyContext;
          if (pastWords && pastWords.length > 0) {
            historyInstruction += `\n- Strictly AVOID duplicating any of these previously practiced vocabulary words: ${pastWords.slice(0, 50).join(', ')}.`;
          }
          if ((pastTitles && pastTitles.length > 0) || (pastTopics && pastTopics.length > 0)) {
            const pastItems = [...(pastTitles || []), ...(pastTopics || [])];
            historyInstruction += `\n- Strictly AVOID repeating any of these previously done story scenarios, reading passages, or conversation topics: ${pastItems.slice(0, 20).join(', ')}. Make this exercise fresh, distinct, and a logical progression.`;
          }
          if (historyInstruction) {
            historyInstruction = `\n\nHISTORICAL CONTEXT (AVOID REPEATING):${historyInstruction}`;
          }
        }

        let reinforceInstruction = "";
        if (difficultWords && difficultWords.length > 0) {
          reinforceInstruction = `\n\nREINFORCEMENT WORDS (TRY TO INCORPORATE): The learner has previously struggled with these words. If appropriate for the CEFR level ${level} and topic, try to naturally incorporate/reinforce one or more of these words in this exercise (e.g., in the dialogue, choices, reading passage, or steps/tips): ${difficultWords.slice(0, 30).join(', ')}. Do not force it if it doesn't fit the context, but prioritize them.`;
        }

        const systemPrompt = `You are a linguist and designer of a highly polished, editorial language learning curriculum. 
Your tone is thoughtful, contemplative, and warm, like a designed philosophy journal.
Do not output markdown code blocks, just raw JSON. The response MUST be valid JSON matching the requested structure.`;

        const fullPrompt = `${systemPrompt}${themeInstruction}${historyInstruction}${reinforceInstruction}\n\nTask:\n${modePrompt}`;

        callGemini(fullPrompt, apiKey, (err, geminiRes) => {
          if (err) {
            console.error("[Gemini API Generate Error]:", err);
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
            console.error("[Gemini API Evaluate Error]:", err);
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
