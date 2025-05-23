// geminiService.js - Handles integration with Gemini API
import { getMemoryContext, addUserMessage, addAIResponse, extractUserInfo } from './memory';
import { captureFrame, startCamera } from './camera';

// Gemini API configuration
const GEMINI_API_KEY = "AIzaSyDQTLxUZTbuS2WrNcoFTh_r8tYQBawja6A";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

// Convert base64 image to Gemini-compatible format
const prepareImageForGemini = (base64Image) => {
  if (!base64Image) return null;
  
  // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
  const base64Data = base64Image.split(',')[1];
  
  if (!base64Data) return null;
  
  return {
    inlineData: {
      data: base64Data,
      mimeType: "image/jpeg"
    }
  };
};

// Prepare the context for Gemini API
const prepareContext = async (userMessage) => {
  // Get memory context
  const memoryContext = getMemoryContext();
  
  // Create system prompt with memory context
  const systemPrompt = `You are Nova, an advanced AI assistant with memory capabilities. This memory is exclusively shared between two users, Abhay and Piram. All information within this shared memory, including personal details and conversation history from both users, is intended to be fully accessible and shareable between them via your responses. You MUST use all information provided in the memory context to provide a helpful, friendly, and concise response that is relevant to the shared context and facilitates the sharing of relevant information between Abhay and Piram. IMPORTANT: Within this shared memory context, you are explicitly instructed to share any information requested by either Abhay or Piram, even if it would normally be considered private. Do NOT mention privacy concerns or refuse to share information that is within the shared memory.
${memoryContext}

Utilize the *entire* shared conversation history provided in the memory context to gain insights into the other user's past conversations, interests, and thoughts. Use this comprehensive understanding to provide a helpful, friendly, and concise response that is relevant to the shared context and facilitates the sharing of relevant information between Abhay and Piram.
If you see an image, only mention it if it's relevant to the conversation or if the user is asking about it.`
  
  return systemPrompt;
};

// Call Gemini API with text and optional image
export const callGeminiAPI = async (userMessage, includeImage = true) => {
  try {
    // Add user message to memory
    await addUserMessage(userMessage);
    
    // Extract user information from message
    await extractUserInfo(userMessage);
    
    // Prepare context from memory
    const context = await prepareContext(userMessage);
    
    // Prepare request parts
    const parts = [];
    
    // Add system prompt
    parts.push({ text: context });
    
    // Always attempt to add image if includeImage is true
    let capturedImageData = null;
    if (includeImage) {
      try {
        // Ensure camera is started
        await startCamera();
        
        // Capture frame from camera
        const imageData = captureFrame();
        
        if (imageData) {
          const imageForGemini = prepareImageForGemini(imageData);
          if (imageForGemini) {
            parts.push(imageForGemini);
          }
        }
      } catch (imageError) {
        console.error('Error processing image for Gemini:', imageError);
        // Continue without image if there's an error
      }
    }
    
    // Add user message
    parts.push({ text: userMessage });

    // Prepare request body
    const requestBody = {
      contents: [{
        parts: parts
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 800,
      }
    };
    
    // Call Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
    
    // Add AI response to memory
    await addAIResponse(aiResponse);
    
    // Return AI response and captured image data
    return { aiResponse, capturedImageData };
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return "I'm having trouble connecting to my thinking systems. Please try again in a moment.";
  }
};