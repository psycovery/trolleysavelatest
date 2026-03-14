import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        green: {
          50:  '#E1F5EE',
          100: '#9FE1CB',
          200: '#5DCAA5',
          400: '#5DCAA5',
          600: '#1D9E75',
          700: '#0F6E56',
          800: '#085041',
          900: '#04342C',
        },
        amber: {
          50:  '#FAEEDA',
          200: '#FAC775',
          400: '#EF9F27',
          500: '#BA7517',
          600: '#854F0B',
          700: '#633806',
        },
        gray: {
          50:  '#F1EFE8',
          100: '#D3D1C7',
          200: '#B4B2A9',
          400: '#888780',
          500: '#5F5E5A',
          700: '#444441',
          900: '#2C2C2A',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '14px',
        sm: '8px',
      },
    },
  },
  plugins: [],
}
export default config
