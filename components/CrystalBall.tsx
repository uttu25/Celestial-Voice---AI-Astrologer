import React, { useEffect, useRef } from 'react';
import { AudioVisualizerProps } from '../types';

const CrystalBall: React.FC<AudioVisualizerProps> = ({ analyser, isConnected, isSpeaking }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 3;

      ctx.clearRect(0, 0, width, height);

      // Base Glow
      const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius * 1.5);
      
      let intensity = 0;

      if (analyser && isConnected) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for(let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        intensity = sum / bufferLength;
      }

      // Dynamic Colors based on state
      if (!isConnected) {
        gradient.addColorStop(0, '#334155');
        gradient.addColorStop(1, '#0f172a');
      } else if (isSpeaking) {
        // AI Speaking - Golden/Mystical
        gradient.addColorStop(0, `rgba(253, 224, 71, ${0.4 + (intensity/255)})`);
        gradient.addColorStop(0.5, `rgba(234, 179, 8, ${0.2 + (intensity/500)})`);
        gradient.addColorStop(1, 'transparent');
      } else {
        // Listening - Purple/Deep Blue
        gradient.addColorStop(0, `rgba(168, 85, 247, ${0.4 + (intensity/255)})`);
        gradient.addColorStop(0.5, `rgba(126, 34, 206, ${0.2 + (intensity/500)})`);
        gradient.addColorStop(1, 'transparent');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + (intensity / 3), 0, Math.PI * 2);
      ctx.fill();

      // Inner Core
      ctx.fillStyle = isConnected ? (isSpeaking ? '#fef08a' : '#d8b4fe') : '#475569';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
      
      // Sparkles/Stars inside
      if (isConnected) {
         const time = Date.now() / 1000;
         for(let i=0; i<5; i++) {
             const angle = (time + i) * (Math.PI / 2.5);
             const dist = Math.sin(time * 2 + i) * (radius * 0.5);
             const x = centerX + Math.cos(angle) * dist;
             const y = centerY + Math.sin(angle) * dist;
             
             ctx.fillStyle = 'white';
             ctx.beginPath();
             ctx.arc(x, y, 2, 0, Math.PI * 2);
             ctx.fill();
         }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isConnected, isSpeaking]);

  return (
    <div className="relative flex justify-center items-center h-64 w-64 mx-auto my-8">
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={300} 
        className="z-10"
      />
      <div className={`absolute inset-0 rounded-full blur-3xl transition-opacity duration-1000 ${isConnected ? 'opacity-40' : 'opacity-0'} ${isSpeaking ? 'bg-yellow-500' : 'bg-purple-600'}`}></div>
    </div>
  );
};

export default CrystalBall;
