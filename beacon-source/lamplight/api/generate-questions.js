// Server-side only. Keeps the Gemini key off the browser and checks the
// caller is the logged-in Beacon host before spending any quota.
const SUPABASE_URL = 'https://drklvnkojrzggseutfqc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRya2x2bmtvanJ6Z2dzZXV0ZnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNzk3ODYsImV4cCI6MjEwNTg1NTc4Nn0.QNxToN1RKrvvhSVu-DjgN5UWXUSxMMK3payxU46NU1M';

const SYSTEM = `You write quiz questions for a live Bible-study quiz app called Beacon, used by a South African youth/young-adult group.
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

  try {
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + key,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ parts: [{ text: 'Topic/passage: ' + topic + '\nNumber of questions: ' + count + '\nReturn ONLY the JSON array.' }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
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
