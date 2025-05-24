import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { startCamera, captureFrame } from './camera';
import { getCurrentUser, logout } from './auth';
import { callGeminiAPI } from './geminiService';
import { cloudStorage } from './cloudStorage';
import Login from './Login';


function App() {
  const [capturedImage, setCapturedImage] = useState(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isFadingIn, setIsFadingIn] = useState(false);
  const [aiStatus, setAiStatus] = useState('idle');
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [receivedImage, setReceivedImage] = useState(null);
  const [isReceivedImageFadingIn, setIsReceivedImageFadingIn] = useState(false);
  const [isReceivedImageFadingOut, setIsReceivedImageFadingOut] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceReady, setVoiceReady] = useState(false);
  const [novaVoice, setNovaVoice] = useState(null);
  const [showImageProcessingPopup, setShowImageProcessingPopup] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);

  // Add logging for state changes
  useEffect(() => {
    console.log('State Update: showImageProcessingPopup =', showImageProcessingPopup);
  }, [showImageProcessingPopup]);

  useEffect(() => {
    console.log('State Update: generatedImageUrl =', generatedImageUrl);
  }, [generatedImageUrl]);

  useEffect(() => {
    console.log('State Update: aiStatus =', aiStatus);
  }, [aiStatus]);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const waveformRef = useRef(null);
  const isProcessingRef = useRef(false);
  const recognitionErrorOccurredRef = useRef(false);

  // Initialize shared memory system
  const initializeSharedMemory = () => {
    console.log('Initializing shared memory system...');
    
    // Listen for real-time memory updates
    cloudStorage.onMemoryUpdate((memories) => {
      console.log('Received memory update:', memories);
    });
    
    // Listen for image memory updates
    cloudStorage.onImageMemoryUpdate((imageMemories) => {
      console.log('Received image memory update:', imageMemories);
      const latestImage = imageMemories[imageMemories.length - 1];
      if (latestImage && latestImage.userId !== currentUser?.uid) {
        setReceivedImage(latestImage.imageData);
        setIsReceivedImageFadingIn(true);
        setTimeout(() => {
          setIsReceivedImageFadingIn(false);
          setIsReceivedImageFadingOut(true);
          setTimeout(() => {
            setReceivedImage(null);
            setIsReceivedImageFadingOut(false);
          }, 500);
        }, 3000);
      }
    });
  };

  // Check authentication on startup
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setCurrentUser(user);
      setIsAuthenticated(true);
      initializeSharedMemory();
    }
  }, []);

  // Handle user login
  const handleLogin = (user) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    initializeSharedMemory();
  };

  // Handle user logout
  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setAiStatus('idle');
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  // Initialize voice synthesis
  useEffect(() => {
    if (!isAuthenticated) return;
    
    function setVoice() {
      const voices = synthRef.current.getVoices();
      console.log('Available voices:', voices.map(v => v.name));
      
      const preferredVoiceName = "Google UK English Female";
      const preferred = voices.find(v => v.name === preferredVoiceName) || 
                       voices.find(v => v.default) || 
                       voices[0];
      
      setNovaVoice(preferred);
      setVoiceReady(voices.length > 0);
      console.log('Voice set:', preferred?.name || 'None');
    }
    
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = setVoice;
    }
    setVoice();
  }, [isAuthenticated]);

  // Speech synthesis function
  const speak = (text, startListeningCallback = null, isStreaming = false) => {
    console.log(`Speaking: "${text}", streaming: ${isStreaming}`);
    
    if (!voiceReady || !novaVoice) {
      console.log('Speech synthesis not ready');
      return;
    }

    if (isStreaming && synthRef.current.speaking) {
      synthRef.current.cancel();
    }

    // Split long text into smaller chunks (e.g., by sentences or a character limit)
    // This is a simple split by sentence-ending punctuation followed by a space.
    // More sophisticated splitting might be needed for complex texts.
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = '';
    const maxChunkLength = 200; // Example character limit per chunk

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChunkLength) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    // Set speaking state before starting speech
    if (!isStreaming) {
      setAiStatus('speaking');
    }

    let chunkIndex = 0;

    const speakNextChunk = () => {
      if (chunkIndex < chunks.length) {
        const utter = new window.SpeechSynthesisUtterance(chunks[chunkIndex]);
        if (novaVoice) utter.voice = novaVoice;
        utter.rate = 1.02; // Normal speed
        utter.pitch = 1.1;

        utter.onend = () => {
          console.log(`Chunk ${chunkIndex + 1}/${chunks.length} spoken.`);
          chunkIndex++;
          speakNextChunk(); // Speak the next chunk
        };

        utter.onerror = (event) => {
          console.error('Speech synthesis error:', event.error);
          isProcessingRef.current = false;
          // On synthesis error, attempt to restart listening
          console.log('Attempting to restart listening after speech synthesis error.');
          setAiStatus('listening'); // Try to go back to listening on error
          if (recognitionRef.current) {
            startListening();
          } else {
            setAiStatus('idle'); // Fallback to idle if cannot restart listening
          }
        };

        synthRef.current.speak(utter);
      } else {
        // All chunks spoken
        console.log('All speech chunks ended.');
        setIsFadingIn(false);
        setIsFadingOut(true);
        
        setTimeout(() => {
          setCapturedImage(null);
          setIsFadingOut(false);
          isProcessingRef.current = false;

          // Always transition to listening after speech ends
          console.log('Transitioning to listening after speech end.');
          setAiStatus('listening');

          // Attempt to restart recognition after a short delay
          if (recognitionRef.current) {
             console.log('Attempting to restart recognition after speech end.');
             // No delay needed here, startListening has its own checks
            
          }
        }, 500); // Delay for image fade out
      }
    };

    speakNextChunk(); // Start speaking the first chunk
  };

  // Initialize speech recognition
  useEffect(() => {
    if (!voiceReady || !isAuthenticated) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported');
      speak('Speech recognition is not supported in your browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    // Define startListening inside App so it is always in scope
    const startListening = () => {
      if (!voiceReady || !isAuthenticated) return;
      if (!recognitionRef.current) {
        console.error('Speech recognition not supported or not initialized.');
        speak('Speech recognition is not supported in your browser.');
        return;
      }
      const recognition = recognitionRef.current;
      if (isProcessingRef.current) {
        console.log('Still processing previous command, skipping new recognition start.');
        return;
      }
      if (recognition.recognizing) {
        console.log('Speech recognition already recognizing, not starting again.');
        return;
      }
      try {
        console.log('Attempting to start speech recognition...');
        recognition.start();
        setAiStatus('listening');
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        if (error.name === 'InvalidStateError') {
          console.log('Start failed with InvalidStateError. Relying on onend to restart.');
        } else {
          speak(`Error starting speech recognition: ${error.message}`, startListening);
          setAiStatus('idle');
        }
      }
    };

    recognition.onend = () => {
       console.log('Speech recognition ended');
       // Handle recognition end states
      if (recognitionErrorOccurredRef.current) {
        console.log('Recognition ended after an error, not restarting automatically.');
        recognitionErrorOccurredRef.current = false;
        if (!synthRef.current.speaking) {
          setAiStatus('idle');
        }
        isProcessingRef.current = false;
        return;
      }

      // If recognition ends while speaking, the speak onend handler will manage the state transition and restart.
      if (synthRef.current.speaking) {
        console.log('Recognition ended while speaking, deferring restart to speak onend.');
        return;
      }

      // If recognition ends while processing (API call or speaking), do not restart immediately.
      // The processing logic or speak onend will handle the next state and restart.
      if (isProcessingRef.current) {
         console.log('Recognition ended while processing, not restarting.');
         // State is already 'processing' or will be set by speak
         return;
      }

      // If recognition ends cleanly or timed out and not processing, attempt restart.
      console.log('Recognition ended cleanly or timed out, attempting restart.');
      // Set status to listening before attempting restart
      setAiStatus('listening');
      // No delay needed here, startListening has its own checks
      startListening();
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      recognitionErrorOccurredRef.current = true; // Set the flag on error
      isProcessingRef.current = false;

      // Attempt to transition to listening state on most errors to try and recover
      if (event.error !== 'aborted' && event.error !== 'not-allowed') {
         setAiStatus('listening');
      } else {
         setAiStatus('idle'); // Stay idle for critical errors like not-allowed or aborted
      }

      if (event.error === 'not-allowed') {
        speak('Microphone access was denied. Please enable microphone access to use voice commands.', startListening);
      } else if (event.error === 'no-speech') {
        console.log('No speech detected, restarting after delay...');
        setTimeout(() => {
          startListening();
        }, 500);
      } else if (event.error === 'audio-capture') {
        console.error('Audio capture error.');
        speak('Audio capture error. Please check your microphone.', startListening);
      } else if (event.error === 'network') {
        console.error('Network error during speech recognition.');
        speak('Network error during speech recognition. Please check your connection.', startListening);
      } else if (event.error === 'aborted') {
        console.log('Recognition aborted, not restarting automatically.');
        // Do not automatically restart on 'aborted' error
      } else {
        speak(`Speech recognition error: ${event.error}`, startListening);
      }
    };

    recognition.onresult = (event) => {
      const processTranscript = async () => {
        try {
          const lastResult = event.results[event.results.length - 1];
          if (!lastResult.isFinal) return;

          const transcript = lastResult[0].transcript.toLowerCase().trim();
          if (!transcript) {
            console.log('Empty transcript, ignoring');
            return;
          }

          console.log('Processing transcript:', transcript);
          isProcessingRef.current = true;
          setAiStatus('processing');

          try {
            // Handle camera commands
            if (transcript.includes('show me my camera') ||
                transcript.includes('show my camera') ||
                transcript.includes('show me my pic')) {
              const imageDataUrl = captureFrame();
              if (imageDataUrl) {
                setCapturedImage(imageDataUrl);
                setIsFadingIn(true);
              }
              return;
            }

            // Handle sharing commands
            if (transcript.includes('share my camera') ||
                transcript.includes('share my pic')) {
              const imageDataUrl = captureFrame();
              if (imageDataUrl && currentUser) {
                await cloudStorage.saveImageMemory(currentUser.uid, imageDataUrl);
                speak("I've shared your camera feed.", startListening);
              }
              return;
            }

            // Handle image generation
            if (transcript.includes('generate image') || 
                transcript.includes('create image')) {
              setShowImageProcessingPopup(true);
              console.log('Calling callGeminiAPI for image generation with transcript:', transcript); // Added log
              const response = await callGeminiAPI(transcript, null, true);
              console.log('Response from callGeminiAPI for image generation:', response); // Added log
              if (response?.generatedImage) {
                setGeneratedImageUrl(response.generatedImage);
                speak('I have generated the image for you.', startListening);
              }
              setShowImageProcessingPopup(false);
              return;
            }

            // Handle general conversation
            console.log('Calling callGeminiAPI with transcript:', transcript); // Added log
            const response = await callGeminiAPI(transcript);
            console.log('Response from callGeminiAPI:', response); // Added log
            if (response?.text) {
              speak(response.text);
            } else {
              speak('I apologize, but I encountered an error processing your request.', startListening);
            }
          } catch (error) {
            console.error('Error processing transcript:', error);
            speak('Sorry, there was an error processing your command.', startListening);
          } finally {
            isProcessingRef.current = false;
            // State transition after processing is handled by speak's onend or recognition's onend
            // Ensure state is set to processing while speaking, and listening after speaking ends
            if (!synthRef.current.speaking) {
              setAiStatus('listening');
              // Attempt to restart recognition immediately after processing if not speaking
              if (recognitionRef.current) {
                 console.log('Attempting to restart recognition after processing.');
                 startListening();
              }
            }
          }
        } catch (error) {
          console.error('Error in processTranscript:', error);
          isProcessingRef.current = false;
          setAiStatus('idle');
        }
      };

      processTranscript();
    };

    recognition.onstart = () => {
      console.log('Speech recognition started');
      setAiStatus('listening');
    };

    // Initialize recognition after a delay
    const initTimeout = setTimeout(() => {
      startListening();
    }, 1000);

    // Cleanup function
    return () => {
      clearTimeout(initTimeout);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [voiceReady, isAuthenticated, currentUser]); // Dependencies array



// Start camera when authenticated
useEffect(() => {
  if (isAuthenticated) {
    startCamera().catch(console.error);
  }
}, [isAuthenticated]);

// Show login if not authenticated
if (!isAuthenticated) {
  return <Login onLogin={handleLogin} />;
}

const closeGeneratedImage = () => {
  setGeneratedImageUrl(null)
}

return (
  <div className={`App nova-bg ${aiStatus}`}>
    <div className="nova-center">
      {/* User Header */}
      <div className="user-header">
        <div className="user-info">
          <div className="user-name">{currentUser?.displayName || 'Guest'}</div>
          <div className="user-status">{aiStatus}</div>
        </div>
        {isAuthenticated && (
          <button className="logout-button" onClick={handleLogout}>Logout</button>
        )}
      </div>
  
      {/* NOVA Interface */}
      {isAuthenticated ? (
        <>
          <div className={`nova-waveform ${aiStatus}`} ref={waveformRef}>
            <div className={`nova-mic-glow ${aiStatus}`}></div>
            <div className={`nova-title ${aiStatus}`}>NOVA</div>
          </div>
          {/* Image Processing Popup */}
          {showImageProcessingPopup && (
            <div className="image-processing-popup">
              <div className="processing-indicator">Processing Image...</div>
            </div>
          )}
  
          {/* Generated Image Fullscreen View */}
          {generatedImageUrl && (
            <div className="generated-image-fullscreen">
              <button className="close-button" onClick={() => setGeneratedImageUrl(null)}>X</button>
              <img src={generatedImageUrl} alt="Generated by AI" />
              <button className="download-button" onClick={() => {
                const link = document.createElement('a');
                link.href = generatedImageUrl;
                link.download = 'generated_image.jpg';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}>Download Image</button>
            </div>
          )}
        </>
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  </div>
)
}
export default App;


function updateNovaGlow(state) {
  const core = document.querySelector('.nova-core');
  if (core) {
    if (state === 'listening') {
      core.style.borderColor = '#00ff00';
      core.style.boxShadow = '0 0 30px #00ff00';
    } else if (state === 'processing') {
      core.style.borderColor = '#00ffff';
      core.style.boxShadow = '0 0 30px #00ffff';
    } else if (state === 'speaking') {
      core.style.borderColor = '#0066ff';
      core.style.boxShadow = '0 0 30px #0066ff';
    }
    core.classList.add('pulse');
  }
}
