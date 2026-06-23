export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key tidak ditemukan' });

  try {
    const { messages, system } = req.body;

    // Convert messages to Gemini format
    const contents = messages.map(m => {
      if (Array.isArray(m.content)) {
        // Vision message
        const parts = m.content.map(c => {
          if (c.type === 'text') return { text: c.text };
          if (c.type === 'image') return {
            inline_data: {
              mime_type: c.source.media_type,
              data: c.source.data
            }
          };
          return null;
        }).filter(Boolean);
        return { role: m.role === 'assistant' ? 'model' : 'user', parts };
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      };
    });

    const body = {
      system_instruction: { parts: [{ text: system || 'Kamu adalah NatMind, asisten AI yang cerdas dan membantu.' }] },
      contents,
      generationConfig: { maxOutputTokens: 1024 }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'Gemini error' });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Tidak ada respons';
    return res.status(200).json({ content: [{ text }] });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
