import { useEffect } from 'react';

export const useWebGLErrorHandler = () => {
  useEffect(() => {
    const handleWebGLError = (event: ErrorEvent) => {
      // Check if this is a WebGL-related error
      if (
        event.error?.message?.includes('WebGL') ||
        event.error?.message?.includes('THREE') ||
        event.message?.includes('WebGL') ||
        event.message?.includes('THREE')
      ) {
        console.warn('WebGL Error detected:', event.error || event.message);
        
        // Prevent the error from being logged multiple times
        event.preventDefault();
        
        // Optionally, you could dispatch a custom event to notify components
        window.dispatchEvent(new CustomEvent('webgl-error', {
          detail: { error: event.error || event.message }
        }));
      }
    };

    const handleContextLost = (event: Event) => {
      console.warn('WebGL context lost, attempting recovery...');
      event.preventDefault();
      
      // Dispatch event to notify components
      window.dispatchEvent(new CustomEvent('webgl-context-lost'));
    };

    const handleContextRestored = () => {
      console.log('WebGL context restored');
      
      // Dispatch event to notify components
      window.dispatchEvent(new CustomEvent('webgl-context-restored'));
    };

    // Add global error handlers
    window.addEventListener('error', handleWebGLError);
    window.addEventListener('webglcontextlost', handleContextLost);
    window.addEventListener('webglcontextrestored', handleContextRestored);

    return () => {
      window.removeEventListener('error', handleWebGLError);
      window.removeEventListener('webglcontextlost', handleContextLost);
      window.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, []);
}; 