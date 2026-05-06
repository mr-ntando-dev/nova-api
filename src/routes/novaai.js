'use strict';
const router = require('express').Router();
const axios  = require('axios');

const ok  = (res, data) => res.json({ success: true, ...data });
const err = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// ─── Persona Definitions ──────────────────────────────────────────────────────
const PERSONAS = {
  default: 'You are NovaAI, an advanced helpful assistant. Be concise, informative, and friendly.',
  coder: 'You are NovaAI Code Expert. You write clean, efficient code with explanations. Always include code blocks with syntax highlighting hints. If asked to fix code, explain what was wrong.',
  tutor: 'You are NovaAI Tutor. You explain concepts simply like teaching a beginner. Use analogies, examples, and break down complex topics step by step. Ask if the user understood.',
  creative: 'You are NovaAI Creative. You are imaginative, poetic, and artistic. You write stories, poems, songs, and creative content with vivid language and emotion.',
  roast: 'You are NovaAI Roast Master. You roast people with witty, savage but harmless humor. Keep it funny, never truly hurtful. Use creative insults and clever wordplay.',
  philosopher: 'You are NovaAI Philosopher. You provide deep, thoughtful perspectives on life, existence, and meaning. Quote philosophers when relevant. Be profound yet accessible.',
  therapist: 'You are NovaAI Wellness Companion. You provide supportive, empathetic responses. You listen actively, validate feelings, and offer gentle guidance. Disclaimer: you are not a real therapist.',
  chef: 'You are NovaAI Chef. You provide recipes, cooking tips, meal plans, and food knowledge. Include ingredient lists, step-by-step instructions, and pro tips.',
  fitness: 'You are NovaAI Fitness Coach. You provide workout routines, exercise form tips, nutrition advice, and motivation. Tailor advice to the user\'s level.',
  translator: 'You are NovaAI Translator. You translate text between languages accurately while preserving tone and context. Also explain cultural nuances when relevant.',
  debater: 'You are NovaAI Debater. You argue both sides of any topic with strong logic and evidence. Present balanced perspectives, then give your reasoned conclusion.',
  storyteller: 'You are NovaAI Storyteller. You craft engaging short stories with vivid characters, plot twists, and satisfying endings. Adapt to any genre requested.'
};

// ─── AI Provider Functions ────────────────────────────────────────────────────
async function callPollinations(system, message) {
  const prompt = encodeURIComponent(`${system}\n\nUser: ${message}\nAssistant:`);
  const r = await axios.get(`https://text.pollinations.ai/${prompt}`, {
    timeout: 30000,
    headers: { 'Accept': 'text/plain' }
  });
  return { reply: r.data.trim(), provider: 'pollinations', model: 'openai' };
}

async function callOpenAI(system, message, model = 'gpt-3.5-turbo') {
  const r = await axios.post('https://api.openai.com/v1/chat/completions', {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: message }
    ],
    max_tokens: 1000,
    temperature: 0.8
  }, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    timeout: 30000
  });
  return { reply: r.data.choices[0].message.content.trim(), provider: 'openai', model, tokens_used: r.data.usage?.total_tokens };
}

async function callHuggingFace(message) {
  const r = await axios.post(
    'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1',
    { inputs: `[INST] ${message} [/INST]`, parameters: { max_new_tokens: 800, temperature: 0.7 } },
    { headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}` }, timeout: 30000 }
  );
  const text = Array.isArray(r.data) ? r.data[0]?.generated_text : r.data?.generated_text;
  return { reply: text?.replace(`[INST] ${message} [/INST]`, '').trim(), provider: 'huggingface', model: 'mistral-7b' };
}

async function getAIResponse(system, message) {
  // Priority: OpenAI → HuggingFace → Pollinations (free)
  if (process.env.OPENAI_API_KEY) {
    try { return await callOpenAI(system, message); } catch(e) { /* fallthrough */ }
  }
  if (process.env.HUGGINGFACE_API_KEY) {
    try { return await callHuggingFace(system + '\n\n' + message); } catch(e) { /* fallthrough */ }
  }
  return await callPollinations(system, message);
}

// ─── Advanced AI Chat with Personas ──────────────────────────────────────────
router.post('/chat', async (req, res) => {
  const { message, persona = 'default', context = '', model } = req.body;
  if (!message) return err(res, 'Missing body: { message }');

  const systemPrompt = PERSONAS[persona] || PERSONAS.default;
  const fullMessage = context ? `Previous context: ${context}\n\nUser: ${message}` : message;

  try {
    if (model && process.env.OPENAI_API_KEY) {
      const result = await callOpenAI(systemPrompt, fullMessage, model);
      return ok(res, { ...result, persona });
    }
    const result = await getAIResponse(systemPrompt, fullMessage);
    ok(res, { ...result, persona });
  } catch (e) {
    err(res, 'AI response failed: ' + e.message, 503);
  }
});

// ─── Code Generation & Explanation ────────────────────────────────────────────
router.post('/code', async (req, res) => {
  const { prompt, language = 'javascript' } = req.body;
  if (!prompt) return err(res, 'Missing body: { prompt }');

  const system = `You are NovaAI Code Generator. Generate clean, well-commented ${language} code. Always wrap code in \`\`\`${language} blocks. After the code, provide a brief explanation of how it works. If fixing code, explain the bug.`;

  try {
    const result = await getAIResponse(system, prompt);
    // Extract code blocks
    const codeMatch = result.reply.match(/```[\s\S]*?```/g);
    ok(res, {
      ...result,
      language,
      code_blocks: codeMatch ? codeMatch.map(c => c.replace(/```\w*\n?/g, '').replace(/```/g, '').trim()) : [],
      full_response: result.reply
    });
  } catch (e) {
    err(res, 'Code generation failed: ' + e.message, 503);
  }
});

// ─── Image Analysis / Vision ──────────────────────────────────────────────────
router.post('/analyze-image', async (req, res) => {
  const { imageUrl, question = 'Describe this image in detail.' } = req.body;
  if (!imageUrl) return err(res, 'Missing body: { imageUrl }');

  try {
    // Use Pollinations vision
    const prompt = encodeURIComponent(`Analyze this image: ${imageUrl}\n\nQuestion: ${question}\n\nProvide a detailed description.`);
    const r = await axios.get(`https://text.pollinations.ai/${prompt}`, { timeout: 30000 });
    ok(res, { imageUrl, question, analysis: r.data.trim(), provider: 'pollinations' });
  } catch (e) {
    err(res, 'Image analysis failed: ' + e.message, 503);
  }
});

// ─── Vision (describe image) ──────────────────────────────────────────────────
router.post('/vision', async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return err(res, 'Missing body: { imageUrl }');
  try {
    const prompt = encodeURIComponent(`You are an image analysis AI. Describe this image in full detail including objects, colors, people, text, setting, mood, and composition: ${imageUrl}`);
    const r = await axios.get(`https://text.pollinations.ai/${prompt}`, { timeout: 30000 });
    ok(res, { imageUrl, description: r.data.trim(), provider: 'pollinations' });
  } catch (e) {
    err(res, e.message, 503);
  }
});

// ─── Text-to-Speech URL ──────────────────────────────────────────────────────
router.post('/tts', async (req, res) => {
  const { text, lang = 'en' } = req.body;
  if (!text) return err(res, 'Missing body: { text }');
  if (text.length > 500) return err(res, 'Text too long (max 500 chars)');
  try {
    // Google TTS URL (unofficial but works)
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
    ok(res, { text, lang, audio_url: ttsUrl, note: 'Stream this URL directly or download it' });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── List Available Models ────────────────────────────────────────────────────
router.get('/models', (req, res) => {
  ok(res, {
    available_models: [
      { id: 'auto', name: 'Auto (best available)', description: 'Automatically picks the best available model', requires_key: false },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast, good for most tasks', requires_key: true, key: 'OPENAI_API_KEY' },
      { id: 'gpt-4', name: 'GPT-4', description: 'Most capable, slower', requires_key: true, key: 'OPENAI_API_KEY' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'GPT-4 but faster', requires_key: true, key: 'OPENAI_API_KEY' },
      { id: 'mistral-7b', name: 'Mistral 7B', description: 'Open-source, fast', requires_key: true, key: 'HUGGINGFACE_API_KEY' },
      { id: 'pollinations', name: 'Pollinations (Free)', description: 'Free AI with no key required', requires_key: false }
    ],
    available_personas: Object.keys(PERSONAS).map(k => ({
      id: k,
      description: PERSONAS[k].slice(0, 80) + '...'
    })),
    configured_keys: {
      openai: !!process.env.OPENAI_API_KEY,
      huggingface: !!process.env.HUGGINGFACE_API_KEY
    }
  });
});

// ─── Rewrite in Different Tones ───────────────────────────────────────────────
router.post('/rewrite', async (req, res) => {
  const { text, tone = 'professional' } = req.body;
  if (!text) return err(res, 'Missing body: { text }');

  const toneGuides = {
    professional: 'Rewrite in a professional, business-appropriate tone.',
    casual: 'Rewrite in a casual, friendly, conversational tone.',
    formal: 'Rewrite in a highly formal, academic tone with sophisticated vocabulary.',
    funny: 'Rewrite in a humorous, witty tone while keeping the meaning.',
    poetic: 'Rewrite in a poetic, artistic tone with metaphors and vivid imagery.',
    academic: 'Rewrite in an academic tone suitable for research papers.',
    'gen-z': 'Rewrite in Gen-Z slang and internet language (no cap, fr fr, etc).'
  };

  const system = `You are a text rewriting assistant. ${toneGuides[tone] || toneGuides.professional} Only output the rewritten text, nothing else.`;

  try {
    const result = await getAIResponse(system, `Rewrite this: "${text}"`);
    ok(res, { original: text, rewritten: result.reply, tone, provider: result.provider });
  } catch (e) {
    err(res, e.message, 503);
  }
});

// ─── AI Story Generator ──────────────────────────────────────────────────────
router.post('/story', async (req, res) => {
  const { prompt, genre = 'fantasy', length = 'medium' } = req.body;
  if (!prompt) return err(res, 'Missing body: { prompt }');

  const lengths = { short: '200 words', medium: '400 words', long: '800 words' };
  const system = `You are NovaAI Storyteller. Write a captivating ${genre} story in approximately ${lengths[length] || '400 words'}. Include vivid descriptions, dialogue, and a satisfying arc. Start the story immediately without preamble.`;

  try {
    const result = await getAIResponse(system, `Story prompt: ${prompt}`);
    ok(res, { prompt, genre, length, story: result.reply, provider: result.provider, word_count: result.reply.split(/\s+/).length });
  } catch (e) {
    err(res, e.message, 503);
  }
});

// ─── AI Quiz Generator ───────────────────────────────────────────────────────
router.post('/quiz', async (req, res) => {
  const { topic, difficulty = 'medium', count = 5 } = req.body;
  if (!topic) return err(res, 'Missing body: { topic }');

  const system = `Generate exactly ${count} ${difficulty} difficulty quiz questions about "${topic}". Format as JSON array: [{"question":"...","options":["A","B","C","D"],"correct":"A","explanation":"..."}]. Only output valid JSON, no other text.`;

  try {
    const result = await getAIResponse(system, `Topic: ${topic}`);
    let questions;
    try {
      // Try to parse JSON from response
      const jsonMatch = result.reply.match(/\[[\s\S]*\]/);
      questions = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      questions = null;
    }
    ok(res, { topic, difficulty, questions: questions || result.reply, provider: result.provider });
  } catch (e) {
    err(res, e.message, 503);
  }
});

// ─── AI Advice ────────────────────────────────────────────────────────────────
router.post('/advice', async (req, res) => {
  const { situation } = req.body;
  if (!situation) return err(res, 'Missing body: { situation }');

  const system = 'You are NovaAI Life Advisor. Give practical, thoughtful advice. Be empathetic but direct. Structure your advice with clear actionable steps. Include pros/cons when relevant.';

  try {
    const result = await getAIResponse(system, situation);
    ok(res, { situation, advice: result.reply, provider: result.provider, disclaimer: 'This is AI-generated advice. Use your own judgment for important decisions.' });
  } catch (e) {
    err(res, e.message, 503);
  }
});

// ─── AI Explain Like I'm 5 ───────────────────────────────────────────────────
router.post('/eli5', async (req, res) => {
  const { topic } = req.body;
  if (!topic) return err(res, 'Missing body: { topic }');

  const system = 'Explain concepts like you\'re talking to a 5-year-old. Use simple words, fun analogies, and relatable examples. Keep it short and engaging. Use emojis to make it fun.';

  try {
    const result = await getAIResponse(system, `Explain: ${topic}`);
    ok(res, { topic, explanation: result.reply, provider: result.provider });
  } catch (e) {
    err(res, e.message, 503);
  }
});

// ─── AI Compliment Generator ──────────────────────────────────────────────────
router.get('/compliment', async (req, res) => {
  const { name = 'friend' } = req.query;
  try {
    const result = await getAIResponse(
      'Generate a unique, heartfelt, creative compliment. Be genuine and specific. One paragraph max.',
      `Generate a wonderful compliment for someone named ${name}`
    );
    ok(res, { name, compliment: result.reply, provider: result.provider });
  } catch (e) {
    err(res, e.message, 503);
  }
});

// ─── AI Pickup Line ───────────────────────────────────────────────────────────
router.get('/pickup', async (req, res) => {
  const { topic = 'random' } = req.query;
  try {
    const result = await getAIResponse(
      'Generate a clever, funny pickup line. It should be witty and charming, not creepy. Just output the line, nothing else.',
      `Theme: ${topic}`
    );
    ok(res, { topic, line: result.reply, provider: result.provider });
  } catch (e) {
    err(res, e.message, 503);
  }
});

// ─── AI Would You Rather ─────────────────────────────────────────────────────
router.get('/wyr', async (req, res) => {
  try {
    const result = await getAIResponse(
      'Generate a creative, thought-provoking "Would You Rather" question. Format: "Would you rather [option A] OR [option B]?" Then briefly explain why each option is interesting. Be creative and original.',
      'Give me a unique would you rather question'
    );
    ok(res, { question: result.reply, provider: result.provider });
  } catch (e) {
    err(res, e.message, 503);
  }
});

module.exports = router;
