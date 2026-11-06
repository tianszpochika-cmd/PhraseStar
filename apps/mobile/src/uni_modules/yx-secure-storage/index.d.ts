/** Native functions return a JSON envelope; see utssdk/interface.uts. */
export function readSecureItem(key: string): string;
export function writeSecureItem(key: string, value: string): string;
export function removeSecureItem(key: string): string;
