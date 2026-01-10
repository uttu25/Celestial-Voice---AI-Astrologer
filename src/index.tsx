import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 1. debug check
try {
  console.log("Attempting to mount React...");
  // Use a small timeout to ensure the WebView is ready
  setTimeout(() => {
     const rootElement = document.getElementById('root');
     if (!rootElement) {
       alert("CRITICAL: Root element missing!");
       return;
     }
     
     const root = ReactDOM.createRoot(rootElement);
     root.render(
       <React.StrictMode>
         <App />
       </React.StrictMode>
     );
  }, 100);
} catch (e: any) {
  alert("Startup Crash: " + e.message);
}
