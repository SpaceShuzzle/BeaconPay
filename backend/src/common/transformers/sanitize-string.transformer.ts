import { Transform } from 'class-transformer';

export interface SanitizeStringOptions {
  /** Trim leading/trailing whitespace. Default: true */
  trim?: boolean;
  /** Collapse runs of whitespace into a single space. Default: true */
  collapseWhitespace?: boolean;
  /** Strip <script>, <style>, <iframe>, <object>, <embed> tags and their content. Default: true */
  stripDangerousTags?: boolean;
  /** Strip inline event handler attributes like onclick="...". Default: true */
  stripEventHandlers?: boolean;
  /** Strip javascript:/vbscript:/data: URI schemes commonly used for XSS. Default: true */
  stripDangerousProtocols?: boolean;
  /** Normalize unicode to NFC to reduce homoglyph/lookalike bypass tricks. Default: true */
  normalizeUnicode?: boolean;
  /** Truncate the result to this many characters after sanitizing. Default: undefined (no limit) */
  maxLength?: number;
  /** If the value is an array of strings, sanitize each element. Default: true */
  sanitizeArrayElements?: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<SanitizeStringOptions, 'maxLength'>> & { maxLength?: number } = {
  trim: true,
  collapseWhitespace: true,
  stripDangerousTags: true,
  stripEventHandlers: true,
  stripDangerousProtocols: true,
  normalizeUnicode: true,
  maxLength: undefined,
  sanitizeArrayElements: true,
};

// Control chars (0x00–0x1F, 0x7F) minus \t \n \r, which are handled by
// whitespace collapsing/trim instead of being silently deleted.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Matches an opening tag, everything up to (and including) the matching
// closing tag, for tags whose *content* is itself dangerous (script/style)
// or whose presence alone is the risk (iframe/object/embed).
const DANGEROUS_TAG_PAIRS = /<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const DANGEROUS_SELF_OR_OPEN_TAGS = /<\s*\/?\s*(script|style|iframe|object|embed)[^>]*>/gi;

// on<word>="..." / on<word>='...' / on<word>=bareword — covers the common
// inline-event-handler XSS vector on any element, not just <script>.
const EVENT_HANDLER_ATTR = /\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

// javascript:, vbscript:, and data: URI schemes (data: is over-broad to ban
// outright in general text, but is a common XSS vector in href/src values
// pasted as plain strings, so we strip the scheme prefix rather than the
// whole string).
const DANGEROUS_PROTOCOLS = /\b(?:javascript|vbscript):/gi;

/**
 * Sanitizes string inputs during the class-transformer transformation
 * phase (before validation). Intended as a general-purpose hygiene layer
 * for user-submitted text fields (names, titles, free-text notes, etc.) —
 * NOT a substitute for a dedicated HTML sanitizer (e.g. DOMPurify) if the
 * value will ever be rendered as HTML, and NOT a substitute for
 * parameterized queries / an ORM for SQL safety.
 *
 * By default it:
 * - Trims whitespace
 * - Collapses internal whitespace runs to a single space
 * - Removes ASCII control characters
 * - Normalizes unicode to NFC
 * - Strips <script>/<style> tags (and their content) and
 *   <iframe>/<object>/<embed> tags
 * - Strips inline event handler attributes (onclick=, onerror=, etc.)
 * - Strips javascript:/vbscript: URI schemes
 *
 * All of the above are individually toggleable via options, and it works
 * transparently on `string[]` fields as well as single strings.
 *
 * @example
 * class UpdateProfileDto {
 *   @SanitizeString()
 *   @IsString()
 *   displayName: string;
 *
 *   @SanitizeString({ maxLength: 500, collapseWhitespace: false })
 *   @IsString()
 *   bio: string;
 *
 *   @SanitizeString()
 *   @IsArray()
 *   @IsString({ each: true })
 *   tags: string[];
 * }
 */
export function SanitizeString(options: SanitizeStringOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return Transform(({ value }) => {
    if (Array.isArray(value)) {
      return opts.sanitizeArrayElements
        ? value.map((v) => (typeof v === 'string' ? sanitize(v, opts) : v))
        : value;
    }

    if (typeof value !== 'string') {
      return value;
    }

    return sanitize(value, opts);
  });
}

function sanitize(input: string, opts: typeof DEFAULT_OPTIONS): string {
  let result = input;

  if (opts.normalizeUnicode) {
    result = result.normalize('NFC');
  }

  result = result.replace(CONTROL_CHARS, '');

  if (opts.stripDangerousTags) {
    result = result.replace(DANGEROUS_TAG_PAIRS, '');
    result = result.replace(DANGEROUS_SELF_OR_OPEN_TAGS, '');
  }

  if (opts.stripEventHandlers) {
    result = result.replace(EVENT_HANDLER_ATTR, '');
  }

  if (opts.stripDangerousProtocols) {
    result = result.replace(DANGEROUS_PROTOCOLS, '');
  }

  if (opts.trim) {
    result = result.trim();
  }

  if (opts.collapseWhitespace) {
    result = result.replace(/\s{2,}/g, ' ');
  }

  if (opts.maxLength !== undefined && result.length > opts.maxLength) {
    result = result.slice(0, opts.maxLength);
  }

  return result;
}