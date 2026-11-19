import '@testing-library/jest-dom';

// Ensure arrayBuffer and text on Blob and File in jsdom
if (typeof Blob !== 'undefined') {
  if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function () {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }

  if (!Blob.prototype.text) {
    Blob.prototype.text = function () {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    };
  }
}

if (typeof File !== 'undefined') {
  if (!File.prototype.arrayBuffer) {
    File.prototype.arrayBuffer = Blob.prototype.arrayBuffer;
  }
  if (!File.prototype.text) {
    File.prototype.text = Blob.prototype.text;
  }
}

// Ensure URL.createObjectURL and revokeObjectURL
if (typeof URL !== 'undefined') {
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => `blob:http://localhost/${Math.random().toString(36).substring(2)}`;
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = () => {};
  }
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock Worker in jsdom for libraries that expect it
if (typeof window !== 'undefined' && !window.Worker) {
  // @ts-expect-error Mock Worker for jsdom environment
  window.Worker = class {
    onmessage = null;
    onerror = null;
    postMessage() {}
    terminate() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
      return false;
    }
  };
}
