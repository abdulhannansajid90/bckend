import fetch from 'node-fetch';

const API_KEY = process.env.GEMINI_API_KEY || "";

const SYSTEM_PROMPT = `You are EcoSort AI, a waste classification assistant for CUI Wah university campus in Pakistan. Your job is to analyze waste items described by students and help them dispose of them correctly in the right campus bin.

Respond ONLY with a valid JSON object. No markdown fences, no explanation, no preamble. The JSON must be directly parseable by JSON.parse().`;

const USER_PROMPT_TEMPLATE = `Analyze this waste item and return ONLY a JSON object with exactly these fields and no others:
{
  "itemName": "name of the identified item",
  "category": "one of: Plastic / Paper / Glass / Metal / Organic / E-Waste / General Waste",
  "isRecyclable": true or false,
  "binColor": "Blue (Recyclable) or Green (General Waste) or Brown (Organic) or Purple (E-Waste)",
  "binType": "Recyclable Bin / General Waste Bin / Organic Bin / E-Waste Drop Point",
  "confidence": integer 0 to 100,
  "disposalTip": "one specific actionable disposal tip, max 20 words",
  "environmentalFact": "one surprising environmental fact about this item, max 25 words",
  "recyclableComponents": ["array", "of", "recyclable", "parts", "if mixed item, else empty array"]
}

Classification rules:
  Recyclable (Blue Bin): clean plastic bottles, paper, cardboard, glass bottles, aluminum cans, metal tins
  Organic (Brown Bin): food scraps, fruit peels, tea bags, biodegradable waste
  E-Waste (Purple): batteries, phones, chargers, electronics
  General Waste (Green Bin): food-soiled paper, broken glass, diapers, mixed material items that cannot be separated

  confidence: your certainty 0-100. Be honest — vague inputs = low score.

  CRITICAL: Return only the JSON. No trailing commas. All 8 fields required.`;

const FALLBACK_RESULT = {
  itemName: "Unknown Item",
  category: "General Waste",
  isRecyclable: false,
  binColor: "Green (General Waste)",
  binType: "General Waste Bin",
  confidence: 0,
  disposalTip: "When in doubt, use the green general waste bin.",
  environmentalFact: "Proper waste sorting can reduce landfill by up to 60%.",
  recyclableComponents: []
};

async function callGemini(parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
  
  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: [{
      role: "user",
      parts: parts
    }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

export async function classifyWasteItem(description, imageBase64) {
  try {
    const parts = [];
    const promptText = description ? `Item description: ${description}\n\n${USER_PROMPT_TEMPLATE}` : USER_PROMPT_TEMPLATE;

    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64
        }
      });
    }
    
    parts.push({ text: promptText });

    let responseText = await callGemini(parts);

    try {
      return JSON.parse(responseText.trim());
    } catch (parseError) {
      // Retry once
      const strictPrompt = "Return ONLY a raw JSON object. Do not wrap in markdown.";
      parts.push({ text: responseText });
      parts.push({ text: strictPrompt });
      
      responseText = await callGemini(parts);
      try {
        return JSON.parse(responseText.trim());
      } catch (e2) {
        return FALLBACK_RESULT;
      }
    }
  } catch (error) {
    console.error("ecoEngine error:", error);
    throw error;
  }
}
