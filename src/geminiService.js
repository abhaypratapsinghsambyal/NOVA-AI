// geminiService.js - Handles Gemini API calls with memory integration
import { getMemoryContext, addUserMessage, addAIResponse, extractUserInfo } from './memory';

const GEMINI_API_KEY = 'AIzaSyD3eg-2WW2Vsp59TB1SAeQluuqewy-WypQ'; // Updated API key
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`; // Using 1.5 Flash model

export async function callGeminiAPI(userMessage, imageData = null) { // Keep imageData parameter for potential multimodal input
  try {
    console.log('Calling Gemini API with message:', userMessage);
    
    // Add user message to memory
    await addUserMessage(userMessage);
    
    // Extract user info from message
    await extractUserInfo(userMessage);
    
    // Get memory context
    const memoryContext = getMemoryContext();
    console.log('Memory context:', memoryContext); // Log memory context
    
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
            // Removed generationConfig as it's not needed for this model/use case
        };
        console.log('Request body:', JSON.stringify(requestBody, null, 2)); // Log request body
    
    const apiUrl = GEMINI_API_URL; // Always use the specified flash URL
    console.log('Using API URL:', apiUrl); // Log API URL

    // Attempt call to Gemini API
    let response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('Primary API response status:', response.status); // Log primary response status

    if (!response.ok) {
      // If primary call fails, throw an error
      const errorText = await response.text(); // Get error response text
      console.error('Primary API error response:', errorText); // Log primary error response
      throw new Error(`Gemini API call failed with status ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('API response data:', data); // Log API response data
    
    let aiResponse = 'Sorry, I could not process that request.';
    let generatedImage = null; // Keep generatedImage variable for potential image output

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
    
    console.log('Gemini API response text:', aiResponse); // Log final AI response text
    console.log('Generated Image Data:', generatedImage ? 'Image data received' : 'No image data');
    
    return { text: aiResponse, generatedImage }; // Changed aiResponse to text to match App.js expectations
    
  } catch (error) {
    console.error('Error calling Gemini API:', error); // Log the error object
    const errorMessage = `Error calling Gemini API: ${error.message}`;
    await addAIResponse(errorMessage);
    return { text: 'Sorry, I encountered an error processing your request.' }; // Changed to match text property
  }
}