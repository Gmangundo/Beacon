// Server-side only. Keeps the Gemini key off the browser and checks the
// caller is the logged-in Beacon host before spending any quota.
// Supports chat-style revisions: pass an optional `history` array of
// {role:'user'|'model', text:'...'} turns to have the model revise its
// previous output ("make them harder", "more about grace", etc.).
const SUPABASE_URL = 'https://drklvnkojrzggseutfqc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRya2x2bmtvanJ6Z2dzZXV0ZnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNzk3ODYsImV4cCI6MjEwNTg1NTc4Nn0.QNxToN1RKrvvhSVu-DjgN5UWXUSxMMK3payxU46NU1M';

const SYSTEM = `You write quiz questions for a live Bible-study quiz app called Beacon, used by a South African youth/young-adult group.

Write in a warm, conversational voice - like an experienced youth leader talking to the group, not a textbook. Prefer questions that spark thinking over dry fact-recall. Mix in reflective "why do you think..." and "what would you do..." phrasing where it fits. For multiple_choice, write plausible distractors that catch common misconceptions, not obviously-wrong ones.

Return ONLY a JSON array (no prose, no markdown fences). Each item:
{"kind":"multiple_choice"|"true_false"|"poll"|"rating"|"word_cloud","prompt":string,"options":string[],"correct_index":number|null,"time":number,"points":number}
Rules:
- Mostly use "multiple_choice" and "true_false"; include at most one "poll", "rating", or "word_cloud" for variety if it fits the topic.
- multiple_choice: 3-4 short options, one correct_index (0-based).
- true_false: options must be exactly ["True","False"], correct_index 0 or 1.
- poll: 2-4 options, correct_index null.
- rating: options is [lowLabel, highLabel] (e.g. ["Strongly disagree","Strongly agree"]), correct_index null.
- word_cloud: options is [], correct_index null.
- Base every fact-based question on the given Bible passage/topic; do not invent unrelated facts.
- Keep prompts under 140 characters. time is seconds (15-30 typical). points is 500-1500 for scored kinds, 0 for poll/rating/word_cloud.
- Never quote long passages verbatim; paraphrase.`;

async function isHost(token) {
  if (!token) return false;
  const userRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
  });
  if (!userRes.ok) return false;
  const hostRes = await fetch(SUPABASE_URL + '/rest/v1/hosts?select=user_id', {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
  });
  if (!hostRes.ok) return false;
  const rows = await hostRes.json();
  return Array.isArray(rows) && rows.length > 0;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  let allowed = false;
  try { allowed = await isHost(token); } catch (e) { allowed = false; }
  if (!allowed) return res.status(403).json({ error: 'not_host' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'ai_not_configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const topic = String((body && body.topic) || '').trim().slice(0, 300);
  const count = Math.min(15, Math.max(1, parseInt((body && body.count), 10) || 8));
  if (!topic) return res.status(400).json({ error: 'missing_topic' });

  // Optional chat history for revisions.
  const history = Array.isArray(body && body.history) ? body.history.slice(-8) : [];

  try {
    // Build the contents array. If history is present, we replay the
    // conversation so the model can revise its previous output.
    const contents = [];
    contents.push({ role: 'user', parts: [{ text: SYSTEM }] });

    if (history.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Topic/passage: ' + topic + '\nNumber of questions: ' + count + '\nReturn ONLY the JSON array.' }]
      });
    } else {
      contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
      for (const turn of history) {
        if (!turn || typeof turn.text !== 'string') continue;
        const role = turn.role === 'model' ? 'model' : 'user';
        contents.push({ role, parts: [{ text: String(turn.text).slice(0, 2000) }] });
      }
      contents.push({
        role: 'user',
        parts: [{ text: 'Return the FULL revised JSON array of questions now, using the same shape as before. No prose, just JSON.' }]
      });
    }

    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + key,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { responseMimeType: 'application/json', temperature: 0.85 }
        })
      }
    );
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'gemini_error', detail: data });
    const text = (((data.candidates || [])[0] || {}).content || {}).parts?.map((p) => p.text || '').join('') || '';
    let questions;
    try { questions = JSON.parse(text); }
    catch (e) { const m = text.match(/\[[\s\S]*\]/); if (!m) throw e; questions = JSON.parse(m[0]); }
    if (!Array.isArray(questions)) throw new Error('not_an_array');
    return res.status(200).json({ questions });
  } catch (e) {
    return res.status(500).json({ error: 'generation_failed', message: String(e && e.message || e) });
  }
};
