// camera.js - Handles camera access and frame capture

let videoElement = null;
let canvasElement = null;
let stream = null;

// Start camera and get video stream
export const startCamera = async () => {
  if (stream) {
    console.log('Camera already started.');
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement = document.createElement('video');
    videoElement.srcObject = stream;
    videoElement.play();
    console.log('Camera started successfully.');
  } catch (error) {
    console.error('Error accessing camera:', error);
    throw new Error('Could not access camera. Please ensure you have a camera connected and grant permissions.');
  }
};

// Capture a frame from the video stream as a base64 image
export const captureFrame = () => {
  if (!videoElement || !stream) {
    console.warn('Camera not started or stream not available.');
    return null;
  }

  if (!canvasElement) {
    canvasElement = document.createElement('canvas');
  }

  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  const context = canvasElement.getContext('2d');
  context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

  // Get image data as base64 string
  const imageData = canvasElement.toDataURL('image/jpeg');
  console.log('Frame captured.');
  return imageData;
};

// Stop camera and release resources
export const stopCamera = () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
    videoElement = null;
    canvasElement = null;
    console.log('Camera stopped.');
  }
};

// Clean up on component unmount or page close
window.addEventListener('beforeunload', stopCamera);