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

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const waveformRef = useRef(null);
  const isProcessingRef = useRef(false);

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
  const speak = (text, isStreaming = false) => {
    console.log(`Speaking: "${text}", streaming: ${isStreaming}`);
    
    if (!voiceReady || !novaVoice) {
      console.log('Speech synthesis not ready');
      return;
    }

    if (isStreaming && synthRef.current.speaking) {
      synthRef.current.cancel();
    }

    const utter = new window.SpeechSynthesisUtterance(text);
    if (novaVoice) utter.voice = novaVoice;
    utter.rate = 1.02;
    utter.pitch = 1.1;

    if (!isStreaming) {
      utter.onend = () => {
        console.log('Speech ended');
        setIsFadingIn(false);
        setIsFadingOut(true);
        setTimeout(() => {
          setCapturedImage(null);
          setIsFadingOut(false);
          setAiStatus('idle');
          isProcessingRef.current = false;
          startListening();
        }, 500);
      };
    }

    utter.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setAiStatus('idle');
      isProcessingRef.current = false;
      startListening();
    };

    synthRef.current.speak(utter);
    if (!isStreaming) {
      setAiStatus('speaking');
    }
    animateWaveform(1);
  };

  // Start listening function
  const startListening = () => {
    if (!recognitionRef.current || aiStatus !== 'idle' || isProcessingRef.current) {
      console.log('Cannot start listening:', { 
        hasRecognition: !!recognitionRef.current, 
        status: aiStatus, 
        processing: isProcessingRef.current 
      });
      return;
    }

    try {
      console.log('Starting speech recognition...');
      recognitionRef.current.start();
    } catch (error) {
      console.error('Error starting recognition:', error);
      setTimeout(startListening, 1000);
    }
  };

  // Initialize speech recognition
  useEffect(() => {
    if (!isAuthenticated || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      console.log('Recognition started');
      setAiStatus('listening');
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setAiStatus('idle');
      isProcessingRef.current = false;
      setTimeout(startListening, 1000);
    };

    recognition.onend = () => {
      console.log('Recognition ended');
      if (aiStatus === 'listening') {
        setAiStatus('idle');
        setTimeout(startListening, 500);
      }
    };

    recognition.onresult = async (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      console.log('Transcript:', transcript);
      
      isProcessingRef.current = true;
      setAiStatus('processing');

      let capturedImageData = null;

      // Handle camera commands
      if (transcript.toLowerCase().includes('show me my camera') ||
          transcript.toLowerCase().includes('show my camera') ||
          transcript.toLowerCase().includes('show me my pic')) {
        const imageDataUrl = captureFrame();
        if (imageDataUrl) {
          setCapturedImage(imageDataUrl);
          setIsFadingIn(true);
          // Format image data for Gemini API
          const [mimeType, base64Data] = imageDataUrl.split(';base64,');
          capturedImageData = {
            mimeType: mimeType.split(':')[1],
            data: base64Data
          };
        }
      }

      // Handle sharing commands
      if (transcript.toLowerCase().includes('share my camera') ||
          transcript.toLowerCase().includes('share my pic')) {
        const imageDataUrl = captureFrame();
        if (imageDataUrl && currentUser) {
          // Note: Sharing image memory directly saves the data URL string.
          // If Gemini needs the structured format for sharing commands too,
          // this part might need adjustment.
          cloudStorage.saveImageMemory(currentUser.uid, imageDataUrl);
          speak("I've shared your camera feed.");
          return;
        } else {
          cloudStorage.saveImageMemory(currentUser.uid, capturedImageData);
          speak("I've shared your camera feed.");
          return;
        }
      }

      try {
        // Use Gemini for all conversational and image/memory queries
        // Call Gemini for any transcript that isn't a camera/share command
        if (!transcript.toLowerCase().includes('show me my camera') &&
            !transcript.toLowerCase().includes('show my camera') &&
            !transcript.toLowerCase().includes('show me my pic') &&
            !transcript.toLowerCase().includes('share my camera') &&
            !transcript.toLowerCase().includes('share my pic')) {

          let generateImage = false;
          if (transcript.toLowerCase().includes('generate image') || transcript.toLowerCase().includes('create image')) {
            generateImage = true;
            setShowImageProcessingPopup(true);
          }

          const { aiResponse, generatedImage } = await callGeminiAPI(transcript, capturedImageData, generateImage);

          if (generatedImage) {
            setGeneratedImageUrl(generatedImage);
            setShowImageProcessingPopup(false);
          } else {
            speak(aiResponse);
          }
          speak(aiResponse.aiResponse);
        }
      } catch (error) {
        console.error('Error processing request:', error);
        speak("Sorry, I encountered an error processing your request.");
      }
    }; // Added closing brace and parenthesis for onresult handler

    // Start listening when voice is ready
    if (voiceReady) {
      setTimeout(startListening, 1000);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }; // Added closing parenthesis for useEffect
  }, [voiceReady, isAuthenticated]);

  // Animate waveform
  const animateWaveform = (level) => {
    setAudioLevel(level);
    setTimeout(() => setAudioLevel(0), 700);
  };

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
    setGeneratedImageUrl(null);
  };

  return (
    <div className="App">
      {/* Image Processing Popup */}
      {showImageProcessingPopup && (
        <div className="image-processing-popup">
          <div className="processing-indicator">Processing Image...</div>
        </div>
      )}

      {/* Generated Image Fullscreen View */}
      {generatedImageUrl && (
        <div className="generated-image-fullscreen">
          <button className="close-button" onClick={closeGeneratedImage}>X</button>
          <img src={generatedImageUrl} alt="Generated by AI" />
          <button className="download-button" onClick={() => {
            const link = document.createElement('a');
            link.href = generatedImageUrl;
            link.download = 'generated_image.jpg'; // Or a more dynamic name
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}>Download Image</button>
        </div>
      )}

      {/* Existing App content */}
      <header className="App-header">
        {/* ... existing header content ... */}
      </header>
      {/* ... rest of your App content ... */}
    </div>
  );
}

export default App;
