import { Router } from 'express';
import { testSmtpConnection } from '../services/sender.js';
import { processCampaign } from '../workers/emailWorker.js';
import { db } from '../config/firebase.js';

const router = Router();

router.post('/test-smtp', async (req, res) => {
  try {
    const { host, port, secure, user, pass } = req.body;
    const result = await testSmtpConnection({ host, port, secure, user, pass });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/send-campaign', async (req, res) => {
  try {
    const { campaignId } = req.body;
    res.json({ success: true, message: 'Campaign started' });
    processCampaign(campaignId).catch((err) =>
      console.error('Campaign processing error:', err)
    );
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/scan-card', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract contact information from this business card image. Return JSON only: {name, email, phone, company, title, address}. If a field is not found, use null.',
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: image,
                },
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    let jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    let jsonStr;
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      jsonMatch = text.match(/{[\s\S]*?}/);
      jsonStr = jsonMatch ? jsonMatch[0].trim() : text.trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { name: '', email: '', phone: '', company: '', title: '', address: '' };
    }

    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
