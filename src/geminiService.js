// geminiService.js - Handles Gemini API calls with memory integration
import { getMemoryContext, addUserMessage, addAIResponse, extractUserInfo } from './memory';

const GEMINI_API_KEY = 'AIzaSyBb0oyTl-uef9Cg0PgIENdg6xWhcIyffD0'; // Replace with your actual API key
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_IMAGE_GENERATION_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent';

const GEMINI_API_URL_FALLBACK = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export async function callGeminiAPI(userMessage, imageData = null, generateImage = false) {
  try {
    console.log('Calling Gemini API with message:', userMessage);
    
    // Add user message to memory
    await addUserMessage(userMessage);
    
    // Extract user info from message
    await extractUserInfo(userMessage);
    
    // Get memory context
    const memoryContext = getMemoryContext();
    
    // Prepare the request body
        const parts = [{ text: userMessage }];

        // Add image data part if provided and valid
        if (imageData && imageData.mimeType && imageData.data) {
            parts.push({
                inlineData: {
                    mimeType: imageData.mimeType,
                    data: imageData.data
                }
            });
        }

        const requestBody = {
            contents: [
                ...memoryContext, // Include previous conversational turns
                {
                    parts: parts,
                    role: 'user' // Current user turn
                }
            ],
            generationConfig: generateImage ? { responseMimeType: 'image/jpeg' } : {} // Add generation config for image output
        };
    
    const apiUrl = generateImage ? GEMINI_IMAGE_GENERATION_URL : GEMINI_API_URL;

    // Attempt primary call to Gemini 2.0 Flash or Image Generation model
    let response = await fetch(`${apiUrl}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      // If primary call fails, try fallback to Gemini 1.5 Flash
      console.warn(`Primary Gemini API call failed with status ${response.status}. Attempting fallback.`);
      response = await fetch(`${GEMINI_API_URL_FALLBACK}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        // If fallback also fails, throw an error
        throw new Error(`Fallback Gemini API call failed with status ${response.status}`);
      }
    }
    
    const data = await response.json();
    
    let aiResponse = 'Sorry, I could not process that request.';
    let generatedImage = null;

    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts) {
        const parts = data.candidates[0].content.parts;
        for (const part of parts) {
            if (part.text) {
                aiResponse = part.text;
            } else if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                generatedImage = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    
    // Add AI response to memory (only text part)
    if (aiResponse && aiResponse !== 'Sorry, I could not process that request.') {
        await addAIResponse(aiResponse);
    }
    
    console.log('Gemini API response:', aiResponse);
    console.log('Generated Image Data:', generatedImage ? 'Image data received' : 'No image data');
    
    return { aiResponse, generatedImage };
    
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    const fallbackResponse = 'Sorry, I encountered an error processing your request.';
    await addAIResponse(fallbackResponse);
    return { aiResponse: fallbackResponse };
  }
}