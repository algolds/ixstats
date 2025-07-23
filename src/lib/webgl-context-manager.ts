// WebGL Context Manager
// Prevents WebGL context loss by managing context creation and cleanup

class WebGLContextManager {
  private static instance: WebGLContextManager;
  private activeContexts = new Set<string>();
  private maxContexts = 8;
  private contextIdCounter = 0;

  private constructor() {}

  static getInstance(): WebGLContextManager {
    if (!WebGLContextManager.instance) {
      WebGLContextManager.instance = new WebGLContextManager();
    }
    return WebGLContextManager.instance;
  }

  canCreateContext(): boolean {
    return this.activeContexts.size < this.maxContexts;
  }

  registerContext(): string | null {
    if (!this.canCreateContext()) {
      console.warn('WebGL context limit reached, using fallback');
      return null;
    }

    const contextId = `webgl_${this.contextIdCounter++}`;
    this.activeContexts.add(contextId);
    return contextId;
  }

  unregisterContext(contextId: string): void {
    this.activeContexts.delete(contextId);
  }

  getActiveContextCount(): number {
    return this.activeContexts.size;
  }

  // Check if WebGL is supported
  isWebGLSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch {
      return false;
    }
  }

  // Check if WebGL2 is supported
  isWebGL2Supported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      return !!gl;
    } catch {
      return false;
    }
  }

  // Get WebGL context info
  getWebGLInfo(): { supported: boolean; version: string; vendor: string; renderer: string } {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
      
      if (!gl) {
        return { supported: false, version: '', vendor: '', renderer: '' };
      }

      return {
        supported: true,
        version: gl.getParameter(gl.VERSION) || '',
        vendor: gl.getParameter(gl.VENDOR) || '',
        renderer: gl.getParameter(gl.RENDERER) || ''
      };
    } catch {
      return { supported: false, version: '', vendor: '', renderer: '' };
    }
  }
}

export const webglContextManager = WebGLContextManager.getInstance(); 