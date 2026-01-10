/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Cinzel', 'serif'],
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'twinkle': 'twinkle 2s infinite ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'shake': 'shake 0.5s ease-in-out',
      },
      keyframes: {
        twinkle: {
          '0%, 100%': { opacity: 0.2 },
          '50%': { opacity: 1 },
        },
        fadeIn: {
          'from': { opacity: 0, transform: 'translateY(-10px)' },
          'to': { opacity: 1, transform: 'translateY(0)' },
        },
        slideUp: {
            'from': { opacity: 0, transform: 'translateY(20px)' },
            'to': { opacity: 1, transform: 'translateY(0)' }
        },
        shake: {
            '0%, 100%': { transform: 'translateX(0)' },
            '25%': { transform: 'translateX(-5px)' },
            '75%': { transform: 'translateX(5px)' }
        }
      }
    },
  },
  plugins: [],
}
