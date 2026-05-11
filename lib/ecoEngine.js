import fetch from 'node-fetch';

const API_KEY = process.env.ANTHROPIC_API_KEY || "";

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

async function callAnthropic(content) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

export async function classifyWasteItem(description, imageBase64) {
  try {
    let content;
    const promptText = description ? `Item description: ${description}\n\n${USER_PROMPT_TEMPLATE}` : USER_PROMPT_TEMPLATE;

    if (imageBase64) {
      content = [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
        { type: "text", text: promptText }
      ];
    } else {
      content = promptText;
    }

    let responseText = await callAnthropic(content);

    try {
      return JSON.parse(responseText.trim());
    } catch (parseError) {
      // Retry once
      const strictPrompt = "Return ONLY a raw JSON object, starting with { and ending with }. No other characters.";
      const retryContent = [
        { type: "text", text: responseText },
        { type: "text", text: strictPrompt }
      ];
      responseText = await callAnthropic(retryContent);
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
