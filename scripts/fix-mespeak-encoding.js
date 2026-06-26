import fs from 'fs';
import path from 'path';

const mespeakSrcDir = path.join('node_modules', 'mespeak', 'src');

if (!fs.existsSync(mespeakSrcDir)) {
  console.log('mespeak package not found in node_modules. Skipping encoding fix.');
  process.exit(0);
}

try {
  const files = fs.readdirSync(mespeakSrcDir);
  for (const file of files) {
    if (file.endsWith('.js')) {
      const filePath = path.join(mespeakSrcDir, file);
      const buf = fs.readFileSync(filePath);
      
      // Check if it's already valid UTF-8
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        decoder.decode(buf);
        // Already valid UTF-8, no need to touch it
      } catch (err) {
        // Not valid UTF-8, convert from Latin1
        console.log(`Converting ${filePath} from Latin1 to UTF-8...`);
        const text = buf.toString('latin1');
        fs.writeFileSync(filePath, text, 'utf8');
        console.log(`Successfully converted ${filePath}!`);
      }
    }
  }
} catch (e) {
  console.error('Error fixing mespeak encoding:', e);
}
