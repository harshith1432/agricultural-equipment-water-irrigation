/**
 * High-Fidelity Zero-Dependency Headless DOM & Parser for AgriSpectra UI QA
 * Provides realistic DOM tree, event propagation, element querying, layout bounds, and canvas contexts.
 */

const VOID_TAGS = new Set([
  'AREA', 'BASE', 'BR', 'COL', 'EMBED', 'HR', 'IMG', 'INPUT',
  'LINK', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR'
]);

export class MockElement {
  constructor(tagName = 'DIV') {
    this.tagName = tagName.toUpperCase();
    this.id = '';
    this.className = '';
    this.nodeType = 1;
    this.parentNode = null;
    this.children = [];
    this.attributes = new Map();
    this.eventListeners = new Map();
    this.style = {};
    this._value = '';
    this._checked = false;
    this._disabled = false;
    this._innerHTML = '';
    this._textContent = '';

    const self = this;
    this.classList = {
      _set: new Set(),
      add: (...tokens) => {
        tokens.forEach(t => {
          if (t) {
            self.classList._set.add(t);
          }
        });
        self.className = Array.from(self.classList._set).join(' ');
      },
      remove: (...tokens) => {
        tokens.forEach(t => self.classList._set.delete(t));
        self.className = Array.from(self.classList._set).join(' ');
      },
      contains: (token) => self.classList._set.has(token),
      toggle: (token, force) => {
        let has = self.classList._set.has(token);
        if (force !== undefined) {
          if (force) self.classList._set.add(token);
          else self.classList._set.delete(token);
        } else {
          if (has) self.classList._set.delete(token);
          else self.classList._set.add(token);
        }
        self.className = Array.from(self.classList._set).join(' ');
        return self.classList._set.has(token);
      }
    };
  }

  get value() {
    return this._value || this.getAttribute('value') || '';
  }

  set value(v) {
    this._value = String(v);
    this.setAttribute('value', String(v));
  }

  get checked() {
    return this._checked;
  }

  set checked(b) {
    this._checked = Boolean(b);
    if (this._checked) this.setAttribute('checked', 'checked');
    else this.removeAttribute('checked');
  }

  get disabled() {
    return this._disabled || this.hasAttribute('disabled');
  }

  set disabled(b) {
    this._disabled = Boolean(b);
    if (this._disabled) this.setAttribute('disabled', 'disabled');
    else this.removeAttribute('disabled');
  }

  get type() {
    return this.getAttribute('type') || (this.tagName === 'BUTTON' ? 'submit' : 'text');
  }

  set type(t) {
    this.setAttribute('type', t);
  }

  get selected() {
    return this.hasAttribute('selected');
  }

  set selected(b) {
    if (b) this.setAttribute('selected', 'selected');
    else this.removeAttribute('selected');
  }

  get options() {
    if (this.tagName !== 'SELECT') return [];
    return this.querySelectorAll('option');
  }

  setAttribute(key, value) {
    const k = key.toLowerCase();
    const strVal = String(value);
    this.attributes.set(k, strVal);
    if (k === 'id') this.id = strVal;
    if (k === 'class') {
      this.className = strVal;
      this.classList._set = new Set(strVal.split(/\s+/).filter(Boolean));
    }
    if (k === 'value') this._value = strVal;
    if (k === 'checked') this._checked = true;
    if (k === 'disabled') this._disabled = true;
  }

  getAttribute(key) {
    const k = key.toLowerCase();
    return this.attributes.get(k) ?? null;
  }

  hasAttribute(key) {
    return this.attributes.has(key.toLowerCase());
  }

  removeAttribute(key) {
    const k = key.toLowerCase();
    this.attributes.delete(k);
    if (k === 'id') this.id = '';
    if (k === 'class') {
      this.className = '';
      this.classList._set.clear();
    }
    if (k === 'checked') this._checked = false;
    if (k === 'disabled') this._disabled = false;
  }

  appendChild(child) {
    if (!child) return child;
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  addEventListener(type, fn) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type).push(fn);
  }

  removeEventListener(type, fn) {
    if (!this.eventListeners.has(type)) return;
    const fns = this.eventListeners.get(type);
    const idx = fns.indexOf(fn);
    if (idx !== -1) fns.splice(idx, 1);
  }

  dispatchEvent(event) {
    const evt = typeof event === 'string' ? { type: event } : event;
    try { if (!evt.target) evt.target = this; } catch (e) {}
    try { if (!evt.currentTarget) evt.currentTarget = this; } catch (e) {}
    if (!evt.preventDefault) evt.preventDefault = () => {};
    if (!evt.stopPropagation) evt.stopPropagation = () => {};

    const listeners = this.eventListeners.get(evt.type) || [];
    const promises = [];
    for (const fn of [...listeners]) {
      try {
        const res = fn.call(this, evt);
        if (res && typeof res.then === 'function') {
          promises.push(res);
        }
      } catch (err) {
        console.error(`[MockElement Dispatch Error] (${evt.type}):`, err);
      }
    }
    if (promises.length > 0) {
      return Promise.all(promises);
    }
    return true;
  }

  click() {
    return this.dispatchEvent({ type: 'click', target: this, currentTarget: this });
  }

  focus() {
    this.dispatchEvent({ type: 'focus', target: this, currentTarget: this });
  }

  blur() {
    this.dispatchEvent({ type: 'blur', target: this, currentTarget: this });
  }

  // Simulated geometric layout bounds
  getBoundingClientRect() {
    const isHidden = this.classList.contains('hidden') || this.style.display === 'none';
    if (isHidden) {
      return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 };
    }
    let width = 120;
    let height = 44;
    if (this.tagName === 'BUTTON') {
      width = this.classList.contains('p-2') || this.classList.contains('p-1.5') ? 40 : 120;
      height = 44;
    } else if (this.tagName === 'INPUT') {
      width = 220;
      height = 44;
    } else if (this.tagName === 'CANVAS') {
      width = 380;
      height = 180;
    }
    return { top: 10, left: 10, width, height, bottom: 10 + height, right: 10 + width };
  }

  get offsetWidth() { return this.getBoundingClientRect().width; }
  get offsetHeight() { return this.getBoundingClientRect().height; }
  get clientWidth() { return this.getBoundingClientRect().width; }
  get clientHeight() { return this.getBoundingClientRect().height; }

  // Canvas 2D Context Mock
  getContext(type) {
    if (this.tagName === 'CANVAS' && type === '2d') {
      if (!this._ctx2d) {
        this._ctx2d = {
          canvas: this,
          clearRect: () => {},
          fillRect: () => {},
          strokeRect: () => {},
          beginPath: () => {},
          closePath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          stroke: () => {},
          fill: () => {},
          arc: () => {},
          createLinearGradient: () => ({ addColorStop: () => {} }),
          setTransform: () => {},
          save: () => {},
          restore: () => {},
          measureText: (text) => ({ width: (String(text).length || 1) * 8 }),
          strokeStyle: '#000000',
          fillStyle: '#000000',
          lineWidth: 1
        };
      }
      return this._ctx2d;
    }
    return null;
  }

  get innerHTML() {
    if (this._innerHTML) return this._innerHTML;
    if (this.children && this.children.length > 0) {
      return this.children.map(c => c.innerHTML || '').join('');
    }
    return '';
  }

  set innerHTML(html) {
    this._innerHTML = String(html);
    this.children = [];
    parseHtmlInto(this._innerHTML, this);
  }

  get textContent() {
    const parts = [];
    function collect(el) {
      if (el._textContent) parts.push(el._textContent);
      for (const child of el.children) {
        collect(child);
      }
    }
    collect(this);
    if (parts.length > 0) {
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    }
    return this._innerHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  set textContent(txt) {
    this._textContent = String(txt);
    this._innerHTML = String(txt);
    this.children = [];
  }

  matches(selector) {
    return matchSelector(this, selector);
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr.nodeType === 1 && matchSelector(curr, selector)) {
        return curr;
      }
      curr = curr.parentNode;
    }
    return null;
  }

  querySelector(selector) {
    const list = this.querySelectorAll(selector);
    return list.length > 0 ? list[0] : null;
  }

  querySelectorAll(selector) {
    const results = [];
    const selectors = selector.split(',').map(s => s.trim()).filter(Boolean);

    for (const sel of selectors) {
      const parts = sel.split(/\s+/).filter(Boolean);
      queryParts(this, parts, results);
    }

    // Deduplicate preserving order
    return Array.from(new Set(results));
  }
}

function queryParts(root, parts, results) {
  if (parts.length === 0) return;
  const currentPart = parts[0];
  const remainingParts = parts.slice(1);

  function search(el) {
    for (const child of el.children) {
      if (matchSelector(child, currentPart)) {
        if (remainingParts.length === 0) {
          results.push(child);
        } else {
          queryParts(child, remainingParts, results);
        }
      }
      search(child);
    }
  }

  search(root);
}

function matchSelector(el, selector) {
  if (!el || !selector) return false;
  if (selector === '*') return true;

  // Split selector into components (tag, #id, .class, [attr])
  const regex = /([a-zA-Z0-9_-]+)|#([a-zA-Z0-9_-]+)|\.([a-zA-Z0-9_-]+)|\[([a-zA-Z0-9_:-]+)(?:([*^$]?=)(["']?)(.*?)\6)?\]/g;
  let match;
  let hasTag = false;
  let tagMatch = true;
  let idMatch = true;
  let classMatch = true;
  let attrMatch = true;

  while ((match = regex.exec(selector)) !== null) {
    const [full, tag, id, cls, attrName, op, quote, attrVal] = match;

    if (tag) {
      hasTag = true;
      if (el.tagName !== tag.toUpperCase()) tagMatch = false;
    } else if (id) {
      if (el.id !== id && el.getAttribute('id') !== id) idMatch = false;
    } else if (cls) {
      if (!el.classList.contains(cls)) classMatch = false;
    } else if (attrName) {
      if (!el.hasAttribute(attrName)) {
        attrMatch = false;
      } else if (op && attrVal !== undefined) {
        const val = el.getAttribute(attrName);
        if (op === '=' && val !== attrVal) attrMatch = false;
        else if (op === '*=' && (!val || !val.includes(attrVal))) attrMatch = false;
        else if (op === '^=' && (!val || !val.startsWith(attrVal))) attrMatch = false;
        else if (op === '$=' && (!val || !val.endsWith(attrVal))) attrMatch = false;
      }
    }
  }

  return tagMatch && idMatch && classMatch && attrMatch;
}

/**
 * Fast & safe HTML parser turning string templates into a MockElement tree.
 */
export function parseHtmlInto(html, rootElement) {
  let pos = 0;
  const len = html.length;
  let currentParent = rootElement;

  while (pos < len) {
    const nextLt = html.indexOf('<', pos);
    if (nextLt === -1) {
      // Remaining text
      const text = html.slice(pos).trim();
      if (text) {
        const textNode = new MockElement('SPAN');
        textNode._textContent = text;
        currentParent.appendChild(textNode);
      }
      break;
    }

    if (nextLt > pos) {
      const text = html.slice(pos, nextLt).trim();
      if (text) {
        const textNode = new MockElement('SPAN');
        textNode._textContent = text;
        currentParent.appendChild(textNode);
      }
    }

    // Comment
    if (html.startsWith('<!--', nextLt)) {
      const endComment = html.indexOf('-->', nextLt + 4);
      pos = endComment === -1 ? len : endComment + 3;
      continue;
    }

    // End tag
    if (html.startsWith('</', nextLt)) {
      const endGt = html.indexOf('>', nextLt + 2);
      if (endGt === -1) break;
      if (currentParent.parentNode) {
        currentParent = currentParent.parentNode;
      }
      pos = endGt + 1;
      continue;
    }

    // Start tag
    const endGt = html.indexOf('>', nextLt);
    if (endGt === -1) break;

    const tagContent = html.slice(nextLt + 1, endGt).trim();
    const isSelfClosing = tagContent.endsWith('/') || VOID_TAGS.has(tagContent.split(/\s+/)[0].toUpperCase());
    const cleanTag = isSelfClosing && tagContent.endsWith('/') ? tagContent.slice(0, -1).trim() : tagContent;

    const spaceIdx = cleanTag.search(/\s/);
    const tagName = spaceIdx === -1 ? cleanTag : cleanTag.slice(0, spaceIdx);
    const attrString = spaceIdx === -1 ? '' : cleanTag.slice(spaceIdx).trim();

    const element = new MockElement(tagName);
    parseAttributes(attrString, element);

    currentParent.appendChild(element);

    if (!isSelfClosing && !VOID_TAGS.has(element.tagName)) {
      currentParent = element;
    }

    pos = endGt + 1;
  }
}

function parseAttributes(attrString, element) {
  if (!attrString) return;
  const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = attrRegex.exec(attrString)) !== null) {
    const key = match[1];
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    element.setAttribute(key, val);
  }
}

/**
 * Initializes global headless environment for test runners
 */
export function setupHeadlessDOM() {
  if (!globalThis.confirm) {
    globalThis.confirm = () => true;
  }
  if (!globalThis.alert) {
    globalThis.alert = () => {};
  }
  if (!globalThis.prompt) {
    globalThis.prompt = () => '';
  }

  if (!globalThis.localStorage) {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (key) => store.get(key) || null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (i) => Array.from(store.keys())[i] || null
    };
  }

  if (!globalThis.window) {
    globalThis.window = {
      innerWidth: 390,
      innerHeight: 844,
      location: {
        protocol: 'http:',
        hostname: 'localhost',
        pathname: '/',
        search: '',
        replaceState: () => {}
      },
      confirm: globalThis.confirm,
      alert: globalThis.alert,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {}
    };
  } else if (!globalThis.window.location) {
    globalThis.window.location = {
      protocol: 'http:',
      hostname: 'localhost',
      pathname: '/',
      search: '',
      replaceState: () => {}
    };
  }

  const mockBody = new MockElement('BODY');
  const mockDocument = {
    createElement: (tag) => new MockElement(tag),
    getElementById: (id) => mockBody.querySelector(`#${id}`),
    querySelector: (sel) => mockBody.querySelector(sel),
    querySelectorAll: (sel) => mockBody.querySelectorAll(sel),
    body: mockBody,
    documentElement: new MockElement('HTML'),
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {}
  };

  globalThis.document = mockDocument;
  return { document: mockDocument, body: mockBody };
}
