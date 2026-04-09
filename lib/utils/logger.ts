export const logger = {
  log: (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    console.error(...args);
  }
};
