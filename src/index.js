import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <div id="invisible-click-target" style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}></div>
    <App />
  </React.StrictMode>
);

// Simulate a click on the invisible element after a short delay
setTimeout(() => {
  const clickTarget = document.getElementById('invisible-click-target');
  if (clickTarget) {
    clickTarget.click();
    console.log('Simulated click on invisible element.');
  }
}, 100);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.unregister();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
