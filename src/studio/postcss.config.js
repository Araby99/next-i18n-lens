import tailwind from './tailwind.config.js';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';

export default {
  plugins: [
    tailwindcss(tailwind),
    autoprefixer,
  ],
}
