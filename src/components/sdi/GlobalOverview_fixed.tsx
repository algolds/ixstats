// Convert hex to RGB for gradient
const hexToRgb = (hexInput?: string) => {
  let hex = hexInput || '#10b981';
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split('').map(x => x + x).join("");
  }
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result && result.length >= 4) {
    return {
      r: parseInt(result[1] || '0', 16),
      g: parseInt(result[2] || '0', 16),
      b: parseInt(result[3] || '0', 16),
    };
  }
  return { r: 16, g: 185, b: 129 }; // Default green
}; 