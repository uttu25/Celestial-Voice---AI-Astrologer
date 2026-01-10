import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Remove the setTimeout and the try/catch wrapper logic
const startApp = () => {
  try {
    console.log("Attempting to mount React...");
    const rootElement = document.getElementById('root');
    
    if (!rootElement) {
       throw new Error("CRITICAL: Root element missing!");
    }
    
    const root = ReactDOM.createRoot(rootElement);
    root.render(
       <React.StrictMode>
         <App />
       </React.StrictMode>
    );
    console.log("React Mounted Successfully");

  } catch (e: any) {
    console.error("Startup Crash:", e);
    // This ensures you see the error on the phone screen
    alert("Startup Crash: " + e.message);
  }
};

startApp();
