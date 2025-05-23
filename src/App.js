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
        capturedImageData = captureFrame();
        if (capturedImageData) {
          setCapturedImage(capturedImageData);
          setIsFadingIn(true);
        }
      }

      // Handle sharing commands
      if (transcript.toLowerCase().includes('share my camera') ||
          transcript.toLowerCase().includes('share my pic')) {
        capturedImageData = captureFrame();
        if (capturedImageData && currentUser) {
          cloudStorage.saveImageMemory(currentUser.uid, capturedImageData);
          speak("I've shared your camera feed.");
          return;
        } else {
          speak("Sorry, I couldn't share your camera feed right now.");
          return;
        }
      }

      try {
        // Use Gemini for all conversational and image/memory queries
        if (capturedImageData ||
            transcript.toLowerCase().includes('remember') ||
            transcript.toLowerCase().includes('memory') ||
            transcript.toLowerCase().includes('camera') ||
            transcript.toLowerCase().includes('picture')) {

          const aiResponse = callGeminiAPI(transcript, capturedImageData);
          speak(aiResponse);
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

  return (
    <div className="nova-container">
      <div className={`nova-bg ${aiStatus}`}>
        <div className="user-header">
          <div className="user-info">
            <span className="user-name">Welcome, {currentUser?.name}</span>
            <span className="user-status">Shared Memory Active</span>
          </div>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
        
        <div className="nova-center">
          <div className={`nova-waveform ${aiStatus}`} ref={waveformRef} 
               style={{ boxShadow: `0 0 ${40 + audioLevel * 60}px 10px #00fff7, 0 0 ${80 + audioLevel * 120}px 30px #00fff7` }}>
            <svg width="240" height="240" viewBox="0 0 240 240">
              <circle cx="120" cy="120" r={90 + audioLevel * 20} fill="none" stroke="#00fff7" strokeWidth="6" opacity="0.7" />
              <circle cx="120" cy="120" r={60 + audioLevel * 10} fill="none" stroke="#00fff7" strokeWidth="3" opacity="0.3" />
              <circle cx="120" cy="120" r={30 + audioLevel * 5} fill="none" stroke="#00fff7" strokeWidth="2" opacity="0.2" />
            </svg>
            <span className="nova-title">NOVA</span>
          </div>
          <div className="nova-mic-glow" style={{ opacity: aiStatus === 'listening' ? 1 : 0.3 }} />
        </div>
        
        {capturedImage && (aiStatus === 'speaking' || isFadingOut || isFadingIn) && (
          <img src={capturedImage} alt="Captured from camera" 
               className={`camera-popup-image ${isFadingOut ? 'fade-out' : (isFadingIn ? 'fade-in' : '')}`} />
        )}

        {receivedImage && (isReceivedImageFadingIn || isReceivedImageFadingOut) && (
          <img src={receivedImage} alt="Received from other user" 
               className={`camera-popup-image ${isReceivedImageFadingOut ? 'fade-out' : (isReceivedImageFadingIn ? 'fade-in' : '')}`} />
        )}
      </div>
    </div>
  );
}

export default App;
