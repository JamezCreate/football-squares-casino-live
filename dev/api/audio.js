// External ElevenLabs generation is retired. Game-day sounds run locally in the browser.
export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method === 'GET') return res.status(200).json({ configured:true, mode:'local', clips:['score','touchdown','jackpot','voice_score','voice_touchdown','voice_winner'] });
  return res.status(410).json({ error:'ElevenLabs generation was replaced with built-in audio. Use Audio Studio to preview sounds.' });
}
