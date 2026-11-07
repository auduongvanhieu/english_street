import { createRequire } from 'node:module';

/** Country of an IP address (ISO code, e.g. "VN"), from the offline GeoLite2 country table in geoip-country. */
const require = createRequire(import.meta.url);
let lib: { lookup: (ip: string) => { country?: string } | null } | null = null;
export function countryOf(ip: string | undefined): string {
  if (!ip) return '';
  try {
    lib ??= require('geoip-country') as typeof lib;
    return lib!.lookup(ip.replace(/^::ffff:/, ''))?.country ?? '';
  } catch {
    return '';
  }
}
