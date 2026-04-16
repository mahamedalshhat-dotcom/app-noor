import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Helper to extract and parse JSON from a string that might contain markdown blocks
 */
function parseJsonFromResponse(text: string) {
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch (e) {
    // Try to extract from markdown code blocks
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (innerE) {
        console.error("Failed to parse extracted JSON:", innerE);
      }
    }
    
    // Last resort: find the first { and last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        return JSON.parse(text.substring(firstBrace, lastBrace + 1));
      } catch (innerE) {
        console.error("Failed to parse braced JSON:", innerE);
      }
    }
    
    throw e;
  }
}

export async function checkRecitation(audioBase64: string, expectedText: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: "audio/webm",
            data: audioBase64,
          },
        },
        {
          text: `You are a Tajweed and Quran memorization expert. 
          The user is reciting the following text: "${expectedText}".
          Compare their recitation to this provided text. 
          Identify any mistakes in pronunciation, Tajweed (if applicable), or missing/extra words.
          Provide feedback in Arabic. 
          Be encouraging and precise.
          Return the response in a structured format:
          {
            "isCorrect": boolean,
            "feedback": "string",
            "mistakes": ["string"]
          }
          Return ONLY JSON.`,
        },
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    return parseJsonFromResponse(response.text || '{}');
  } catch (error) {
    console.error("AI Recitation Check Error:", error);
    return {
      isCorrect: false,
      feedback: "عذراً، حدث خطأ أثناء تحليل التلاوة. يرجى المحاولة مرة أخرى.",
      mistakes: []
    };
  }
}

export async function getDailyWisdom() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          text: `You are an Islamic scholar and wisdom expert. 
          Provide a daily inspirational message in Arabic. 
          It should include:
          1. A Quranic Ayah or a Hadith (with reference).
          2. A short, practical reflection on how to apply this in modern life.
          3. A "Challenge of the Day" (a small good deed).
          
          Return the response in a structured JSON format:
          {
            "title": "string",
            "source": "string",
            "content": "string",
            "reflection": "string",
            "challenge": "string"
          }
          Return ONLY JSON.`,
        },
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    return parseJsonFromResponse(response.text || '{}');
  } catch (error) {
    console.error("AI Daily Wisdom Error:", error);
    return null;
  }
}

export async function getAyahExplanation(ayahText: string, surahName: string, ayahNumber: number) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          text: `Provide a concise and deep explanation (Tafsir) for the following Ayah in Arabic:
          Surah: ${surahName}, Ayah: ${ayahNumber}
          Text: "${ayahText}"
          
          The explanation should be easy to understand but spiritually profound. 
          Also provide a clear English translation of the Ayah.
          Include:
          1. English translation.
          2. General meaning in Arabic.
          3. Key spiritual lesson in Arabic.
          4. Practical application in Arabic.
          
          Return the response in a structured JSON format:
          {
            "translation": "string",
            "meaning": "string",
            "lesson": "string",
            "application": "string"
          }
          Return ONLY JSON.`,
        },
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    return parseJsonFromResponse(response.text || '{}');
  } catch (error) {
    console.error("AI Ayah Explanation Error:", error);
    return null;
  }
}

export async function askNoorAI(userMessage: string, chatHistory: { role: "user" | "model", parts: { text: string }[] }[]) {
  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      history: chatHistory,
    });

    const systemPrompt = `You are "Noor AI", a highly knowledgeable, compassionate, and wise Islamic assistant. 
    Your goal is to help users with questions about Islam, Quran, Hadith, Fiqh (according to mainstream moderate views), and spiritual growth.
    - Always respond in Arabic.
    - Be respectful and use an encouraging tone.
    - If a question is outside Islamic knowledge, politely redirect the user.
    - Provide references from the Quran or Hadith whenever possible.
    - Keep responses concise but deep.`;

    const result = await chat.sendMessage({ message: `${systemPrompt}\n\nUser: ${userMessage}` });
    return result.text;
  } catch (error) {
    console.error("Noor AI Chat Error:", error);
    return "عذراً، واجهت مشكلة في الاتصال. يرجى المحاولة مرة أخرى.";
  }
}
