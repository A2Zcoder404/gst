module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { prompt } = req.body;
    
    // Read the API key securely from Vercel's Environment Variables
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'API Key not configured on the server.' });
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{
                        text: "You are an AI Financial and GST Assistant for businesses. You must ONLY answer questions strictly related to finance, accounting, taxation, GST (Goods and Services Tax), HSN/SAC codes, and business compliance. If the user asks about ANYTHING outside the financial domain (like coding, general knowledge, weather, etc.), politely decline and state that you are specialized exclusively for finance and taxation queries. Keep your answers concise and professional."
                    }]
                },
                contents: [{
                    parts: [{
                        text: `User query: ${prompt}`
                    }]
                }]
            })
        });

        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
