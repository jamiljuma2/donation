import type { Config } from 'tailwindcss';
export default { content: ['./src/**/*.{ts,tsx}'], theme: { extend: { colors: { forest: '#174c3c', leaf: '#2f7655', cream: '#faf8f3', ink: '#172b25' }, boxShadow: { soft: '0 14px 40px rgba(28,62,48,.08)' } } }, plugins: [] } satisfies Config;
