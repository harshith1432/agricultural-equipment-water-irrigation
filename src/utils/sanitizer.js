/**
 * AgriSpectra Flow & Field - Input Sanitization & XSS Defense Suite
 *
 * Implements OWASP MASVS-CODE & OWASP API Security:
 *  - Strips malicious JavaScript executions, <script> blocks, inline event handlers (onload, onerror, onclick).
 *  - Strips hazardous tags: <iframe>, <object>, <embed>, <applet>, <meta>, <link>, <style>, <form>.
 *  - Neutralizes pseudo-protocols (javascript:, data:text/html, vbscript:).
 *  - Strips invisible ASCII control characters (C0 control codes) preventing log injection and parser corruption.
 *  - Deep object sanitization with prototype pollution prevention (__proto__, constructor, prototype).
 *  - Alphanumeric whitelist validation for agricultural entity names (farm names, crop names, notes, zone IDs).
 */

const DANGEROUS_TAGS_REGEX = /<\/?(?:script|iframe|object|embed|applet|meta|link|style|form|input|button|svg|base)\b[^>]*>/gi;
const EVENT_HANDLER_REGEX = /\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi;
const JAVASCRIPT_PROTOCOL_REGEX = /(?:javascript|vbscript|data\s*:\s*text\/html)\s*:[^"'\s]*/gi;
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const GENERIC_TAG_REGEX = /<[^>]*>/g;

/**
 * Safely strips paired block tags (<tag>...</tag>) including their contents
 * using deterministic iterative string processing.
 * Avoids complex/backtracking regular expressions, completely eliminating CodeQL js/bad-tag-filter.
 *
 * @param {string} source - Input string
 * @param {string} tagName - Tag name (e.g. 'script', 'style')
 * @returns {string} Sanitized string with tag blocks removed
 */
function stripTagBlock(source, tagName) {
  let str = source;
  let prev;

  // Outer loop ensures nested or newly exposed tag pairs (e.g. <scr<script>ipt>) are stripped
  do {
    prev = str;
    let lower = str.toLowerCase();
    const openPrefix = `<${tagName}`;

    let startIdx = lower.indexOf(openPrefix);
    while (startIdx !== -1) {
      // Verify tag boundary: character following tagName must be whitespace, '>', '/', or undefined
      const boundaryChar = lower[startIdx + openPrefix.length];
      if (boundaryChar === undefined || /[\s>/]/.test(boundaryChar)) {
        // Find closing bracket of opening tag
        const openTagEnd = str.indexOf('>', startIdx + openPrefix.length);
        if (openTagEnd === -1) {
          // Unclosed opening tag - strip to end of string to prevent script leakage
          str = str.slice(0, startIdx);
          break;
        }

        // Search for matching closing tag </tagName>
        const closePrefix = `</${tagName}`;
        const closeIdx = lower.indexOf(closePrefix, openTagEnd + 1);
        if (closeIdx !== -1) {
          const closeTagEnd = str.indexOf('>', closeIdx + closePrefix.length);
          if (closeTagEnd !== -1) {
            str = str.slice(0, startIdx) + str.slice(closeTagEnd + 1);
          } else {
            str = str.slice(0, startIdx);
            break;
          }
        } else {
          // Opening tag was closed, but no closing tag exists - strip entire block
          str = str.slice(0, startIdx);
          break;
        }

        lower = str.toLowerCase();
        startIdx = lower.indexOf(openPrefix);
      } else {
        // False match (e.g. <scripture>), skip past this occurrence
        startIdx = lower.indexOf(openPrefix, startIdx + openPrefix.length);
      }
    }
  } while (str !== prev && str.length > 0);

  return str;
}

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;'
};

const HTML_ENTITY_REVERSE = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
  '&#x2F;': '/'
};

/**
 * Escapes HTML sensitive characters to prevent DOM-based XSS
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"'/]/g, (tag) => HTML_ENTITIES[tag] || tag);
}

/**
 * Unescapes HTML entities back to raw characters
 * @param {string} str
 * @returns {string}
 */
export function unescapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&(?:amp|lt|gt|quot|#x27|#39|#x2F);/g, (entity) => HTML_ENTITY_REVERSE[entity] || entity);
}

/**
 * Strips all HTML tags, script execution vectors, event handlers and control characters.
 * All multi-character replacements are executed within defensive fixed-point loops,
 * guaranteeing complete sanitization against nested evasion payloads (CodeQL js/incomplete-multi-character-sanitization)
 * and avoiding catastrophic backtracking (CodeQL js/bad-tag-filter).
 *
 * @param {*} input - String or primitive value
 * @returns {string} Clean, safe text string
 */
export function sanitizeText(input) {
  if (input === null || input === undefined) return '';
  let str = typeof input === 'string' ? input : String(input);

  let outerPrev;
  do {
    outerPrev = str;

    // 1. Remove entire <script>...</script> and <style>...</style> blocks iteratively without regex
    str = stripTagBlock(str, 'script');
    str = stripTagBlock(str, 'style');

    // 2. Remove dangerous HTML tags in a loop until fixed point
    let prevDangerous;
    do {
      prevDangerous = str;
      str = str.replace(DANGEROUS_TAGS_REGEX, '');
    } while (str !== prevDangerous && str.length > 0);

    // 3. Remove inline event handlers (onload=, onerror=, onclick=) in a loop until fixed point
    let prevEvents;
    do {
      prevEvents = str;
      str = str.replace(EVENT_HANDLER_REGEX, '');
    } while (str !== prevEvents && str.length > 0);

    // 4. Neutralize javascript:, vbscript:, data:text/html protocols in a loop until fixed point
    let prevProtocols;
    do {
      prevProtocols = str;
      str = str.replace(JAVASCRIPT_PROTOCOL_REGEX, '');
    } while (str !== prevProtocols && str.length > 0);

    // 5. Remove ASCII control characters
    let prevControl;
    do {
      prevControl = str;
      str = str.replace(CONTROL_CHARS_REGEX, '');
    } while (str !== prevControl && str.length > 0);

    // 6. Strip any residual unclosed/unmatched tag markers '<...>' in a loop until fixed point
    let prevTags;
    do {
      prevTags = str;
      str = str.replace(GENERIC_TAG_REGEX, '');
    } while (str !== prevTags && str.length > 0);

    // 7. Strip isolated angle brackets
    str = str.replace(/[<>]/g, '');

  } while (str !== outerPrev && str.length > 0);

  return str.trim();
}

/**
 * Deep sanitization of objects and arrays
 * Prevents prototype pollution and strips malicious values across all nested properties
 * @param {*} obj - Object or Array to sanitize
 * @returns {*} Sanitized deep clone
 */
export function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    // Avoid prototype pollution: Ignore Object.prototype keys
    const sanitizedObj = {};
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

    for (const key of Object.keys(obj)) {
      if (dangerousKeys.includes(key)) {
        continue;
      }
      const safeKey = sanitizeText(key);
      if (safeKey) {
        sanitizedObj[safeKey] = sanitizeObject(obj[key]);
      }
    }
    return sanitizedObj;
  }

  return obj;
}

/**
 * Validates whether a string consists strictly of alphanumeric characters and allowed delimiters
 * @param {string} str - String to validate
 * @param {string|string[]} [allowedDelimiters=' -_'] - Delimiters allowed (default: space, hyphen, underscore)
 * @returns {boolean}
 */
export function validateAlphanumeric(str, allowedDelimiters = ' -_') {
  if (typeof str !== 'string' || str.length === 0) return false;

  const escapedDelimiters = (Array.isArray(allowedDelimiters) ? allowedDelimiters.join('') : allowedDelimiters)
    .replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

  const regex = new RegExp(`^[a-zA-Z0-9${escapedDelimiters}]+$`);
  return regex.test(str);
}

/**
 * Validates and sanitizes agricultural entity names (farm name, field parcel, zone name)
 * @param {string} name
 * @param {number} [maxLength=100]
 * @returns {string}
 */
export function sanitizeFarmName(name, maxLength = 100) {
  const clean = sanitizeText(name);
  return clean.slice(0, maxLength);
}

/**
 * Validates and sanitizes crop names (e.g. "Almond - Nonpareil")
 * @param {string} crop
 * @param {number} [maxLength=50]
 * @returns {string}
 */
export function sanitizeCropName(crop, maxLength = 50) {
  const clean = sanitizeText(crop);
  return clean.slice(0, maxLength);
}

/**
 * Validates an email address against standard RFC 5322 format
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email.trim()) && email.length <= 254;
}

/**
 * Validates URL safety, ensuring scheme is http, https, capacitor, or relative
 * @param {string} url
 * @returns {string|null} Safe URL or null
 */
export function sanitizeUrl(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Allow relative URLs
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const safeProtocols = ['http:', 'https:', 'capacitor:'];
    if (safeProtocols.includes(parsed.protocol)) {
      return parsed.href;
    }
  } catch {
    // Malformed URL
  }
  return null;
}

export const sanitizer = {
  sanitizeText,
  sanitizeObject,
  validateAlphanumeric,
  escapeHtml,
  unescapeHtml,
  sanitizeFarmName,
  sanitizeCropName,
  isValidEmail,
  sanitizeUrl
};

export default sanitizer;
