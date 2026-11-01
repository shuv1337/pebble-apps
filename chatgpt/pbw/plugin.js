"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod2) => function __require() {
    return mod2 || (0, cb[__getOwnPropNames(cb)[0]])((mod2 = { exports: {} }).exports, mod2), mod2.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod2) => __copyProps(__defProp({}, "__esModule", { value: true }), mod2);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/text-encoder.js
  var require_text_encoder = __commonJS({
    "src/text-encoder.js"() {
      "use strict";
      if (typeof TextEncoder === "undefined") {
        globalThis.TextEncoder = function TextEncoder2() {
        };
        globalThis.TextEncoder.prototype.encode = function(text) {
          var binary = unescape(encodeURIComponent(String(text === void 0 ? "" : text)));
          var bytes = new Uint8Array(binary.length);
          for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          return bytes;
        };
      }
    }
  });

  // src/util.js
  var require_util = __commonJS({
    "src/util.js"(exports, module) {
      "use strict";
      function PluginError(code, message) {
        var error = new Error(message);
        error.code = code;
        return error;
      }
      function bytesToBinary(bytes) {
        var binary = "";
        for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return binary;
      }
      function binaryToBytes(binary) {
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
      }
      function base64(bytes) {
        return btoa(bytesToBinary(bytes));
      }
      function base64url(bytes) {
        return base64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      }
      function fromBase64(text) {
        var normal = text.replace(/-/g, "+").replace(/_/g, "/");
        while (normal.length % 4) normal += "=";
        return binaryToBytes(atob(normal));
      }
      function utf8(text) {
        return binaryToBytes(unescape(encodeURIComponent(text)));
      }
      function fromUtf8(bytes) {
        return decodeURIComponent(escape(bytesToBinary(bytes)));
      }
      function uuid() {
        var bytes = new Uint8Array(16);
        if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
        else for (var j = 0; j < 16; j++) bytes[j] = Math.floor(Math.random() * 256);
        bytes[6] = bytes[6] & 15 | 64;
        bytes[8] = bytes[8] & 63 | 128;
        var hex = "";
        for (var i = 0; i < 16; i++) hex += ("0" + bytes[i].toString(16)).slice(-2);
        return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
      }
      function jwtClaims(token) {
        var parts = typeof token === "string" ? token.split(".") : [];
        if (parts.length !== 3) return null;
        try {
          return JSON.parse(fromUtf8(fromBase64(parts[1])));
        } catch (_) {
          return null;
        }
      }
      function toMillis(value) {
        var n = Number(value) || 0;
        return n && n < 1e12 ? Math.round(n * 1e3) : n;
      }
      function form(fields) {
        return Object.keys(fields).map(function(key) {
          return encodeURIComponent(key) + "=" + encodeURIComponent(fields[key]);
        }).join("&");
      }
      function pick(items, query, label, noun) {
        if (!items.length) throw PluginError("PLUGIN_UNAVAILABLE", "No " + noun + "s found.");
        if (!query) return items[0];
        var wanted = String(query).trim().toLowerCase();
        var exact = items.filter(function(item) {
          return item.id.toLowerCase() === wanted || label(item).toLowerCase() === wanted;
        });
        var matches = exact.length ? exact : items.filter(function(item) {
          return label(item).toLowerCase().indexOf(wanted) >= 0;
        });
        if (matches.length === 1) return matches[0];
        var names = (matches.length ? matches : items).slice(0, 8).map(function(item) {
          return '"' + label(item) + '"';
        }).join(", ");
        throw PluginError("INVALID_ARGS", (matches.length ? "More than one " : "No ") + noun + ' matches "' + query + '". Choose one of: ' + names + ".");
      }
      module.exports = {
        PluginError,
        base64,
        base64url,
        fromBase64,
        utf8,
        fromUtf8,
        uuid,
        jwtClaims,
        form,
        pick,
        toMillis
      };
    }
  });

  // src/dots.js
  var require_dots = __commonJS({
    "src/dots.js"(exports, module) {
      "use strict";
      var util = require_util();
      var PluginError = util.PluginError;
      var uuid = util.uuid;
      var KEY = "chatgpt-dots.connection.v1";
      var API = "https://chatgpt.com/backend-api";
      var MAX_MESSAGE = 16e3;
      function createDotsService(storage, fetch2, auth) {
        async function load() {
          var session = await auth.load();
          var raw = await storage.getItem(KEY);
          var state = raw ? JSON.parse(raw) : null;
          return state && session && state.account === session.account && state.user === session.user ? Object.assign({ email: session.email }, state) : null;
        }
        async function required() {
          var state = await load();
          if (state) return state;
          if (await auth.load()) throw PluginError("PLUGIN_UNAVAILABLE", "No Dot found. Set up a Dot in ChatGPT, then sign in again in plugin settings.");
          throw PluginError("AUTH_REQUIRED", "Sign in to ChatGPT in plugin settings.");
        }
        async function failure(response, path) {
          if (response.status === 401) return PluginError("AUTH_REQUIRED", "ChatGPT sign-in expired. Sign in again in plugin settings.");
          if (response.status === 403) {
            return PluginError(
              "PERMISSION_DENIED",
              "ChatGPT blocked the request or wants you to verify your account. Open ChatGPT, then sign in again."
            );
          }
          if (response.status === 429) return PluginError("RATE_LIMITED", "ChatGPT is rate limiting requests. Try again shortly.");
          if (response.status === 404 && path === "/tbo/primary") {
            var body = null;
            try {
              body = await response.json();
            } catch (_) {
            }
            if (body && body.detail === "Not Found") {
              return PluginError("PLUGIN_UNAVAILABLE", "ChatGPT Dots is not available in your region yet.");
            }
          }
          return PluginError("PLUGIN_UNAVAILABLE", "ChatGPT returned an error (HTTP " + response.status + ").");
        }
        async function call(session, method, path, body) {
          var response = await fetch2(API + path, {
            method,
            headers: {
              "Authorization": "Bearer " + session.accessToken,
              "ChatGPT-Account-Id": session.account,
              "X-OpenAI-Expected-Account-Id": session.account,
              "Content-Type": "application/json"
            },
            body: body === void 0 ? void 0 : JSON.stringify(body)
          });
          if (response.status < 200 || response.status >= 300) {
            console.error("ChatGPT " + method + " " + path.replace(/\/(by-thread|rooms)\/[^/]+/g, "/$1/:id") + ": HTTP " + response.status);
            var error = await failure(response, path);
            error.status = response.status;
            throw error;
          }
          return response.json();
        }
        async function authed(method, path, body) {
          var session = await auth.current();
          try {
            return await call(session, method, path, body);
          } catch (error) {
            if (error.status !== 401) throw error;
            return call(await auth.renew(), method, path, body);
          }
        }
        async function discover() {
          var primary = await authed("GET", "/tbo/primary");
          var selection = primary && primary.selection;
          if (!selection || !selection.available) {
            throw PluginError("PLUGIN_UNAVAILABLE", "No Dot found. Set up a Dot in ChatGPT first.");
          }
          if (!selection.thread_id || !selection.aeon_id || !selection.messaging_room_id) {
            throw PluginError("PLUGIN_UNAVAILABLE", "ChatGPT returned an incomplete Dot.");
          }
          var profile = await authed("GET", "/tbo/by-thread/" + encodeURIComponent(selection.thread_id));
          if (!profile || profile.status !== "active" || profile.id !== selection.aeon_id || profile.messaging_room_id !== selection.messaging_room_id || profile.active_root_thread_id && profile.active_root_thread_id !== selection.thread_id) {
            throw PluginError("PLUGIN_UNAVAILABLE", "Your Dot did not match its room. Open ChatGPT, then sign in again.");
          }
          var room = await authed("GET", "/messaging/rooms/" + encodeURIComponent(profile.messaging_room_id));
          var members = room && Array.isArray(room.members) ? room.members : [];
          var hasDot = members.some(function(m) {
            return m && m.aeon_id === profile.id && m.account_user_id;
          });
          var humans = members.filter(function(m) {
            return m && !m.aeon_id;
          });
          var session = await auth.load();
          if (!room || room.type !== "DM" || room.app_source !== "chatgpt:messaging" || room.id !== profile.messaging_room_id || room.aeon_id !== profile.id || members.length !== 2 || !hasDot || humans.length !== 1 || !session || !session.user || humans[0].account_user_id !== session.user) {
            throw PluginError("PLUGIN_UNAVAILABLE", "Your Dot did not match its room. Open ChatGPT, then sign in again.");
          }
          return { account: session.account, user: session.user, room: room.id, dotName: typeof profile.display_name === "string" && profile.display_name ? profile.display_name : "Dot" };
        }
        function status(state) {
          return state ? { configured: true, email: state.email, dotName: state.dotName } : { configured: false };
        }
        async function connect() {
          var dot = await discover();
          await storage.setItem(KEY, JSON.stringify({ account: dot.account, user: dot.user, room: dot.room, dotName: dot.dotName }));
          return status(await load());
        }
        async function disconnect() {
          await storage.removeItem(KEY);
          return status(null);
        }
        async function send(args) {
          var text = args && args.message;
          if (typeof text !== "string" || !text.trim() || text.length > MAX_MESSAGE) {
            throw PluginError("INVALID_ARGS", "Provide a message between 1 and 16,000 characters.");
          }
          var state = await required();
          var id = uuid();
          var sent = await authed("POST", "/messaging/rooms/" + encodeURIComponent(state.room) + "/messages", {
            content: { text },
            request_id: id,
            idempotency_token: id
          });
          if (!sent || !sent.id || sent.request_id !== id) {
            throw PluginError("PLUGIN_UNAVAILABLE", "ChatGPT did not confirm the message; check your Dot before sending again.");
          }
          return { text: "Message sent to " + state.dotName + "." };
        }
        return {
          status: async function() {
            return status(await load());
          },
          connect,
          disconnect,
          send
        };
      }
      module.exports = { createDotsService };
    }
  });

  // node_modules/@noble/hashes/_u64.js
  function fromBig(n, le = false) {
    if (le)
      return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
    return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
  }
  function split(lst, le = false) {
    const len = lst.length;
    let Ah = new Uint32Array(len);
    let Al = new Uint32Array(len);
    for (let i = 0; i < len; i++) {
      const { h, l } = fromBig(lst[i], le);
      [Ah[i], Al[i]] = [h, l];
    }
    return [Ah, Al];
  }
  function setU64FromNum(view, byteOffset, n, isLE2) {
    const h = fromNumH(n);
    const l = fromNumL(n);
    view.setUint32(byteOffset, isLE2 ? l : h, isLE2);
    view.setUint32(byteOffset + 4, isLE2 ? h : l, isLE2);
  }
  function add(Ah, Al, Bh, Bl) {
    const l = (Al >>> 0) + (Bl >>> 0);
    return { h: Ah + Bh + (l / 2 ** 32 | 0) | 0, l: l | 0 };
  }
  var U32_MASK64, _32n, fromNumH, fromNumL, shrSH, shrSL, rotrSH, rotrSL, rotrBH, rotrBL, add3L, add3H, add4L, add4H, add5L, add5H;
  var init_u64 = __esm({
    "node_modules/@noble/hashes/_u64.js"() {
      U32_MASK64 = /* @__PURE__ */ (() => BigInt(2 ** 32 - 1))();
      _32n = /* @__PURE__ */ BigInt(32);
      fromNumH = (n) => n / 2 ** 32 | 0;
      fromNumL = (n) => n >>> 0;
      shrSH = (h, _l, s) => h >>> s;
      shrSL = (h, l, s) => h << 32 - s | l >>> s;
      rotrSH = (h, l, s) => h >>> s | l << 32 - s;
      rotrSL = (h, l, s) => h << 32 - s | l >>> s;
      rotrBH = (h, l, s) => h << 64 - s | l >>> s - 32;
      rotrBL = (h, l, s) => h >>> s - 32 | l << 64 - s;
      add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
      add3H = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0;
      add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
      add4H = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0;
      add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
      add5H = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;
    }
  });

  // node_modules/@noble/hashes/utils.js
  function isBytes(a) {
    return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
  }
  function anumber(n, title = "") {
    if (typeof n !== "number")
      throw new TypeError(atitle(title) + "expected number, got " + typeof n);
    if (!Number.isSafeInteger(n) || n < 0)
      throw new RangeError(atitle(title) + "expected integer >= 0, got " + n);
    return n;
  }
  function abool(value, title = "") {
    if (typeof value !== "boolean")
      throw new TypeError(atitle(title) + "expected boolean, got type=" + typeof value);
    return value;
  }
  function abytes(value, length, title = "") {
    if (isBytes(value) && (length === void 0 || value.length === length))
      return value;
    if (length !== void 0)
      anumber(length, "length");
    const bytes = isBytes(value);
    const ofLen = length !== void 0 ? ` of length ${length}` : "";
    const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
    const message = atitle(title) + "expected Uint8Array" + ofLen + ", got " + got;
    if (!bytes)
      throw new TypeError(message);
    throw new RangeError(message);
  }
  function ahash(h) {
    if (typeof h !== "function" || typeof h.create !== "function")
      throw new TypeError("expected hash wrapped by utils.createHasher");
    anumber(h.outputLen);
    anumber(h.blockLen);
    if (h.outputLen < 1 || h.blockLen < 1)
      throw new Error("hash blockLen / outputLen must be >= 1");
  }
  function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
      throw new Error("hash was destroyed");
    if (checkFinished && instance.finished)
      throw new Error("digest() was already called");
  }
  function aoutput(out, instance) {
    abytes(out, void 0, "output");
    const min = instance.outputLen;
    if (!(out.length >= min)) {
      throw new RangeError('"output" expected length >= ' + min);
    }
  }
  function u32(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
  }
  function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
      arrays[i].fill(0);
    }
  }
  function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  function rotr(word, shift) {
    return word << 32 - shift | word >>> shift;
  }
  function byteSwap(word) {
    return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
  }
  function byteSwap32(arr) {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = byteSwap(arr[i]);
    }
    return arr;
  }
  function bytesToHex(bytes) {
    abytes(bytes);
    if (hasHexBuiltin)
      return bytes.toHex();
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += hexes[bytes[i]];
    }
    return hex;
  }
  function asciiToBase16(ch) {
    return ch >= 48 && ch <= 57 ? ch - 48 : ch >= 65 && ch <= 70 ? ch - (65 - 10) : ch >= 97 && ch <= 102 ? ch - (97 - 10) : void 0;
  }
  function hexToBytes(hex) {
    if (typeof hex !== "string")
      throw new TypeError("hex string expected, got " + typeof hex);
    if (hasHexBuiltin) {
      try {
        return Uint8Array.fromHex(hex);
      } catch (error) {
        if (error instanceof SyntaxError)
          throw new RangeError(error.message);
        throw error;
      }
    }
    const hl = hex.length;
    const al = hl / 2;
    if (hl % 2)
      throw new RangeError("hex string expected, got unpadded hex of length " + hl);
    const array = new Uint8Array(al);
    for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
      const n1 = asciiToBase16(hex.charCodeAt(hi));
      const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
      if (n1 === void 0 || n2 === void 0) {
        const char = hex[hi] + hex[hi + 1];
        throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
      }
      array[ai] = n1 * 16 + n2;
    }
    return array;
  }
  function utf8ToBytes(str) {
    if (typeof str !== "string")
      throw new TypeError("string expected");
    const encoded = new TextEncoder().encode(str);
    try {
      return new Uint8Array(encoded);
    } finally {
      clean(encoded);
    }
  }
  function concatBytes(...arrays) {
    let sum = 0;
    for (let i = 0; i < arrays.length; i++) {
      const a = arrays[i];
      abytes(a);
      sum += a.length;
    }
    const res = new Uint8Array(sum);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
      const a = arrays[i];
      res.set(a, pad);
      pad += a.length;
    }
    return res;
  }
  function checkOpts(defaults, opts, title = "opts") {
    aopts(defaults, "defaults");
    if (opts !== void 0)
      aopts(opts, title);
    const merged = Object.assign(/* @__PURE__ */ Object.create(null), defaults, opts);
    return merged;
  }
  function createHasher(hashCons, info = {}) {
    if (typeof hashCons !== "function")
      throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
    info = checkOpts({}, info, "info");
    const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
    const tmp = hashCons(void 0);
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.canXOF = tmp.canXOF;
    hashC.create = (opts) => hashCons(opts);
    Object.assign(hashC, info);
    return Object.freeze(hashC);
  }
  function randomBytes(bytesLength = 32) {
    anumber(bytesLength, "bytesLength");
    const cr = typeof globalThis === "object" ? globalThis.crypto : null;
    if (typeof cr?.getRandomValues !== "function")
      throw new Error("crypto.getRandomValues must be defined");
    if (bytesLength > 65536)
      throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
    return cr.getRandomValues(new Uint8Array(bytesLength));
  }
  var atitle, aobject, aopts, isLE, swap32IfBE, hasHexBuiltin, hexes, oidNist;
  var init_utils = __esm({
    "node_modules/@noble/hashes/utils.js"() {
      atitle = (title) => title ? `"${title}" ` : "";
      aobject = (value, label) => {
        if (value === null || typeof value !== "object" || Array.isArray(value))
          throw new TypeError((label === "object" ? "" : `"${label}" `) + "expected object, got type=" + typeof value);
      };
      aopts = (value, label) => {
        aobject(value, label);
        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null)
          throw new TypeError(`"${label}" expected plain object`);
        if (Object.hasOwn(value, "__proto__"))
          throw new TypeError(`"${label}.__proto__" is not allowed`);
      };
      isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
      swap32IfBE = isLE ? (u) => u : byteSwap32;
      hasHexBuiltin = /* @__PURE__ */ (() => (
        // @ts-ignore
        typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
      ))();
      hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
      oidNist = (suffix) => ({
        // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
        // Larger suffix values would need base-128 OID encoding and a different length byte.
        oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
      });
    }
  });

  // node_modules/@noble/hashes/_md.js
  function Chi(a, b, c) {
    return a & b ^ ~a & c;
  }
  function Maj(a, b, c) {
    return a & b ^ a & c ^ b & c;
  }
  var HashMD, SHA256_IV, SHA224_IV, SHA384_IV, SHA512_IV;
  var init_md = __esm({
    "node_modules/@noble/hashes/_md.js"() {
      init_u64();
      init_utils();
      HashMD = class {
        constructor(blockLen, outputLen, padOffset, isLE2) {
          __publicField(this, "blockLen");
          __publicField(this, "outputLen");
          __publicField(this, "canXOF", false);
          __publicField(this, "padOffset");
          __publicField(this, "isLE");
          // For partial updates less than block size
          __publicField(this, "buffer");
          __publicField(this, "view");
          __publicField(this, "finished", false);
          __publicField(this, "length", 0);
          __publicField(this, "pos", 0);
          __publicField(this, "destroyed", false);
          this.blockLen = blockLen;
          this.outputLen = outputLen;
          this.padOffset = padOffset;
          this.isLE = isLE2;
          this.buffer = new Uint8Array(blockLen);
          this.view = createView(this.buffer);
        }
        update(data) {
          aexists(this);
          abytes(data);
          const { view, buffer, blockLen } = this;
          const len = data.length;
          let processed = false;
          for (let pos = 0; pos < len; ) {
            const take = Math.min(blockLen - this.pos, len - pos);
            if (take === blockLen) {
              const dataView = createView(data);
              for (; blockLen <= len - pos; pos += blockLen)
                this.process(dataView, pos);
              processed = true;
              continue;
            }
            buffer.set(pos === 0 && take === len ? data : data.subarray(pos, pos + take), this.pos);
            this.pos += take;
            pos += take;
            if (this.pos === blockLen) {
              this.process(view, 0);
              this.pos = 0;
              processed = true;
            }
          }
          this.length += data.length;
          if (processed)
            this.roundClean();
          return this;
        }
        digestInto(out) {
          aexists(this);
          aoutput(out, this);
          this.finished = true;
          const { buffer, view, blockLen, isLE: isLE2 } = this;
          let { pos } = this;
          buffer[pos++] = 128;
          buffer.fill(0, pos);
          if (this.padOffset > blockLen - pos) {
            this.process(view, 0);
            buffer.fill(0);
          }
          setU64FromNum(view, blockLen - 8, this.length * 8, isLE2);
          this.process(view, 0);
          this.roundClean();
          const oview = out === buffer ? view : createView(out);
          const len = this.outputLen;
          const outLen = len / 4;
          const state = this.get();
          if (len % 4 || outLen > state.length)
            throw new Error("invalid outputLen");
          for (let i = 0; i < outLen; i++)
            oview.setUint32(4 * i, state[i], isLE2);
        }
        digest() {
          const { buffer, outputLen } = this;
          this.digestInto(buffer);
          const res = buffer.slice(0, outputLen);
          this.destroy();
          return res;
        }
        _cloneIntoMeta(to) {
          const { buffer, length, finished, destroyed, pos } = this;
          to.destroyed = destroyed;
          to.finished = finished;
          to.length = length;
          to.pos = pos;
          if (pos)
            to.buffer.set(buffer);
          return to;
        }
        clone() {
          return this._cloneInto();
        }
      };
      SHA256_IV = /* @__PURE__ */ Uint32Array.from([
        1779033703,
        3144134277,
        1013904242,
        2773480762,
        1359893119,
        2600822924,
        528734635,
        1541459225
      ]);
      SHA224_IV = /* @__PURE__ */ Uint32Array.from([
        3238371032,
        914150663,
        812702999,
        4144912697,
        4290775857,
        1750603025,
        1694076839,
        3204075428
      ]);
      SHA384_IV = /* @__PURE__ */ Uint32Array.from([
        3418070365,
        3238371032,
        1654270250,
        914150663,
        2438529370,
        812702999,
        355462360,
        4144912697,
        1731405415,
        4290775857,
        2394180231,
        1750603025,
        3675008525,
        1694076839,
        1203062813,
        3204075428
      ]);
      SHA512_IV = /* @__PURE__ */ Uint32Array.from([
        1779033703,
        4089235720,
        3144134277,
        2227873595,
        1013904242,
        4271175723,
        2773480762,
        1595750129,
        1359893119,
        2917565137,
        2600822924,
        725511199,
        528734635,
        4215389547,
        1541459225,
        327033209
      ]);
    }
  });

  // node_modules/@noble/hashes/sha2.js
  var sha2_exports = {};
  __export(sha2_exports, {
    _SHA224: () => _SHA224,
    _SHA256: () => _SHA256,
    _SHA384: () => _SHA384,
    _SHA512: () => _SHA512,
    _SHA512_224: () => _SHA512_224,
    _SHA512_256: () => _SHA512_256,
    sha224: () => sha224,
    sha256: () => sha256,
    sha384: () => sha384,
    sha512: () => sha512,
    sha512_224: () => sha512_224,
    sha512_256: () => sha512_256
  });
  var SHA256_K, SHA256_W, SHA2_32B, _SHA256, _SHA224, K512, SHA512_Kh, SHA512_Kl, SHA512_W_H, SHA512_W_L, SHA2_64B, _SHA512, _SHA384, T224_IV, T256_IV, _SHA512_224, _SHA512_256, sha256, sha224, sha512, sha384, sha512_256, sha512_224;
  var init_sha2 = __esm({
    "node_modules/@noble/hashes/sha2.js"() {
      init_md();
      init_u64();
      init_utils();
      SHA256_K = /* @__PURE__ */ Uint32Array.from([
        1116352408,
        1899447441,
        3049323471,
        3921009573,
        961987163,
        1508970993,
        2453635748,
        2870763221,
        3624381080,
        310598401,
        607225278,
        1426881987,
        1925078388,
        2162078206,
        2614888103,
        3248222580,
        3835390401,
        4022224774,
        264347078,
        604807628,
        770255983,
        1249150122,
        1555081692,
        1996064986,
        2554220882,
        2821834349,
        2952996808,
        3210313671,
        3336571891,
        3584528711,
        113926993,
        338241895,
        666307205,
        773529912,
        1294757372,
        1396182291,
        1695183700,
        1986661051,
        2177026350,
        2456956037,
        2730485921,
        2820302411,
        3259730800,
        3345764771,
        3516065817,
        3600352804,
        4094571909,
        275423344,
        430227734,
        506948616,
        659060556,
        883997877,
        958139571,
        1322822218,
        1537002063,
        1747873779,
        1955562222,
        2024104815,
        2227730452,
        2361852424,
        2428436474,
        2756734187,
        3204031479,
        3329325298
      ]);
      SHA256_W = /* @__PURE__ */ new Uint32Array(64);
      SHA2_32B = class extends HashMD {
        constructor(outputLen, IV) {
          super(64, outputLen, 8, false);
          // We cannot use array here since array allows indexing by variable
          // which means optimizer/compiler cannot use registers.
          // Numeric initializers matter: starting the fields as `undefined` changes
          // V8's field representation and makes sha256 3x slower (measured).
          __publicField(this, "A", 0);
          __publicField(this, "B", 0);
          __publicField(this, "C", 0);
          __publicField(this, "D", 0);
          __publicField(this, "E", 0);
          __publicField(this, "F", 0);
          __publicField(this, "G", 0);
          __publicField(this, "H", 0);
          this.A = IV[0] | 0;
          this.B = IV[1] | 0;
          this.C = IV[2] | 0;
          this.D = IV[3] | 0;
          this.E = IV[4] | 0;
          this.F = IV[5] | 0;
          this.G = IV[6] | 0;
          this.H = IV[7] | 0;
        }
        get() {
          const { A, B: B2, C, D, E, F, G, H } = this;
          return [A, B2, C, D, E, F, G, H];
        }
        // prettier-ignore
        set(A, B2, C, D, E, F, G, H) {
          this.A = A | 0;
          this.B = B2 | 0;
          this.C = C | 0;
          this.D = D | 0;
          this.E = E | 0;
          this.F = F | 0;
          this.G = G | 0;
          this.H = H | 0;
        }
        _cloneInto(to) {
          (to || (to = new this.constructor())).set(...this.get());
          return this._cloneIntoMeta(to);
        }
        process(view, offset) {
          for (let i = 0; i < 16; i++, offset += 4)
            SHA256_W[i] = view.getUint32(offset, false);
          for (let i = 16; i < 64; i++) {
            const W15 = SHA256_W[i - 15];
            const W2 = SHA256_W[i - 2];
            const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
            const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
            SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
          }
          let { A, B: B2, C, D, E, F, G, H } = this;
          for (let i = 0; i < 64; i++) {
            const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
            const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
            const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
            const T2 = sigma0 + Maj(A, B2, C) | 0;
            H = G;
            G = F;
            F = E;
            E = D + T1 | 0;
            D = C;
            C = B2;
            B2 = A;
            A = T1 + T2 | 0;
          }
          A = A + this.A | 0;
          B2 = B2 + this.B | 0;
          C = C + this.C | 0;
          D = D + this.D | 0;
          E = E + this.E | 0;
          F = F + this.F | 0;
          G = G + this.G | 0;
          H = H + this.H | 0;
          this.set(A, B2, C, D, E, F, G, H);
        }
        roundClean() {
          clean(SHA256_W);
        }
        destroy() {
          this.destroyed = true;
          this.set(0, 0, 0, 0, 0, 0, 0, 0);
          clean(this.buffer);
        }
      };
      _SHA256 = class extends SHA2_32B {
        constructor() {
          super(32, SHA256_IV);
        }
      };
      _SHA224 = class extends SHA2_32B {
        constructor() {
          super(28, SHA224_IV);
        }
      };
      K512 = /* @__PURE__ */ (() => split([
        "0x428a2f98d728ae22",
        "0x7137449123ef65cd",
        "0xb5c0fbcfec4d3b2f",
        "0xe9b5dba58189dbbc",
        "0x3956c25bf348b538",
        "0x59f111f1b605d019",
        "0x923f82a4af194f9b",
        "0xab1c5ed5da6d8118",
        "0xd807aa98a3030242",
        "0x12835b0145706fbe",
        "0x243185be4ee4b28c",
        "0x550c7dc3d5ffb4e2",
        "0x72be5d74f27b896f",
        "0x80deb1fe3b1696b1",
        "0x9bdc06a725c71235",
        "0xc19bf174cf692694",
        "0xe49b69c19ef14ad2",
        "0xefbe4786384f25e3",
        "0x0fc19dc68b8cd5b5",
        "0x240ca1cc77ac9c65",
        "0x2de92c6f592b0275",
        "0x4a7484aa6ea6e483",
        "0x5cb0a9dcbd41fbd4",
        "0x76f988da831153b5",
        "0x983e5152ee66dfab",
        "0xa831c66d2db43210",
        "0xb00327c898fb213f",
        "0xbf597fc7beef0ee4",
        "0xc6e00bf33da88fc2",
        "0xd5a79147930aa725",
        "0x06ca6351e003826f",
        "0x142929670a0e6e70",
        "0x27b70a8546d22ffc",
        "0x2e1b21385c26c926",
        "0x4d2c6dfc5ac42aed",
        "0x53380d139d95b3df",
        "0x650a73548baf63de",
        "0x766a0abb3c77b2a8",
        "0x81c2c92e47edaee6",
        "0x92722c851482353b",
        "0xa2bfe8a14cf10364",
        "0xa81a664bbc423001",
        "0xc24b8b70d0f89791",
        "0xc76c51a30654be30",
        "0xd192e819d6ef5218",
        "0xd69906245565a910",
        "0xf40e35855771202a",
        "0x106aa07032bbd1b8",
        "0x19a4c116b8d2d0c8",
        "0x1e376c085141ab53",
        "0x2748774cdf8eeb99",
        "0x34b0bcb5e19b48a8",
        "0x391c0cb3c5c95a63",
        "0x4ed8aa4ae3418acb",
        "0x5b9cca4f7763e373",
        "0x682e6ff3d6b2b8a3",
        "0x748f82ee5defb2fc",
        "0x78a5636f43172f60",
        "0x84c87814a1f0ab72",
        "0x8cc702081a6439ec",
        "0x90befffa23631e28",
        "0xa4506cebde82bde9",
        "0xbef9a3f7b2c67915",
        "0xc67178f2e372532b",
        "0xca273eceea26619c",
        "0xd186b8c721c0c207",
        "0xeada7dd6cde0eb1e",
        "0xf57d4f7fee6ed178",
        "0x06f067aa72176fba",
        "0x0a637dc5a2c898a6",
        "0x113f9804bef90dae",
        "0x1b710b35131c471b",
        "0x28db77f523047d84",
        "0x32caab7b40c72493",
        "0x3c9ebe0a15c9bebc",
        "0x431d67c49c100d4c",
        "0x4cc5d4becb3e42b6",
        "0x597f299cfc657e2a",
        "0x5fcb6fab3ad6faec",
        "0x6c44198c4a475817"
      ].map((n) => BigInt(n))))();
      SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
      SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
      SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
      SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
      SHA2_64B = class extends HashMD {
        constructor(outputLen, IV) {
          super(128, outputLen, 16, false);
          // We cannot use array here since array allows indexing by variable
          // which means optimizer/compiler cannot use registers.
          // h -- high 32 bits, l -- low 32 bits
          // Numeric initializers matter: starting the fields as `undefined` changes
          // V8's field representation and slows hashing down (measured on sha256).
          __publicField(this, "Ah", 0);
          __publicField(this, "Al", 0);
          __publicField(this, "Bh", 0);
          __publicField(this, "Bl", 0);
          __publicField(this, "Ch", 0);
          __publicField(this, "Cl", 0);
          __publicField(this, "Dh", 0);
          __publicField(this, "Dl", 0);
          __publicField(this, "Eh", 0);
          __publicField(this, "El", 0);
          __publicField(this, "Fh", 0);
          __publicField(this, "Fl", 0);
          __publicField(this, "Gh", 0);
          __publicField(this, "Gl", 0);
          __publicField(this, "Hh", 0);
          __publicField(this, "Hl", 0);
          this.Ah = IV[0] | 0;
          this.Al = IV[1] | 0;
          this.Bh = IV[2] | 0;
          this.Bl = IV[3] | 0;
          this.Ch = IV[4] | 0;
          this.Cl = IV[5] | 0;
          this.Dh = IV[6] | 0;
          this.Dl = IV[7] | 0;
          this.Eh = IV[8] | 0;
          this.El = IV[9] | 0;
          this.Fh = IV[10] | 0;
          this.Fl = IV[11] | 0;
          this.Gh = IV[12] | 0;
          this.Gl = IV[13] | 0;
          this.Hh = IV[14] | 0;
          this.Hl = IV[15] | 0;
        }
        // prettier-ignore
        get() {
          const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
          return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
        }
        // prettier-ignore
        set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
          this.Ah = Ah | 0;
          this.Al = Al | 0;
          this.Bh = Bh | 0;
          this.Bl = Bl | 0;
          this.Ch = Ch | 0;
          this.Cl = Cl | 0;
          this.Dh = Dh | 0;
          this.Dl = Dl | 0;
          this.Eh = Eh | 0;
          this.El = El | 0;
          this.Fh = Fh | 0;
          this.Fl = Fl | 0;
          this.Gh = Gh | 0;
          this.Gl = Gl | 0;
          this.Hh = Hh | 0;
          this.Hl = Hl | 0;
        }
        _cloneInto(to) {
          (to || (to = new this.constructor())).set(...this.get());
          return this._cloneIntoMeta(to);
        }
        process(view, offset) {
          for (let i = 0; i < 16; i++, offset += 4) {
            SHA512_W_H[i] = view.getUint32(offset);
            SHA512_W_L[i] = view.getUint32(offset += 4);
          }
          for (let i = 16; i < 80; i++) {
            const W15h = SHA512_W_H[i - 15] | 0;
            const W15l = SHA512_W_L[i - 15] | 0;
            const s0h = rotrSH(W15h, W15l, 1) ^ rotrSH(W15h, W15l, 8) ^ shrSH(W15h, W15l, 7);
            const s0l = rotrSL(W15h, W15l, 1) ^ rotrSL(W15h, W15l, 8) ^ shrSL(W15h, W15l, 7);
            const W2h = SHA512_W_H[i - 2] | 0;
            const W2l = SHA512_W_L[i - 2] | 0;
            const s1h = rotrSH(W2h, W2l, 19) ^ rotrBH(W2h, W2l, 61) ^ shrSH(W2h, W2l, 6);
            const s1l = rotrSL(W2h, W2l, 19) ^ rotrBL(W2h, W2l, 61) ^ shrSL(W2h, W2l, 6);
            const SUMl = add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
            const SUMh = add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
            SHA512_W_H[i] = SUMh | 0;
            SHA512_W_L[i] = SUMl | 0;
          }
          let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
          for (let i = 0; i < 80; i++) {
            const sigma1h = rotrSH(Eh, El, 14) ^ rotrSH(Eh, El, 18) ^ rotrBH(Eh, El, 41);
            const sigma1l = rotrSL(Eh, El, 14) ^ rotrSL(Eh, El, 18) ^ rotrBL(Eh, El, 41);
            const CHIh = Eh & Fh ^ ~Eh & Gh;
            const CHIl = El & Fl ^ ~El & Gl;
            const T1ll = add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
            const T1h = add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
            const T1l = T1ll | 0;
            const sigma0h = rotrSH(Ah, Al, 28) ^ rotrBH(Ah, Al, 34) ^ rotrBH(Ah, Al, 39);
            const sigma0l = rotrSL(Ah, Al, 28) ^ rotrBL(Ah, Al, 34) ^ rotrBL(Ah, Al, 39);
            const MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
            const MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
            Hh = Gh | 0;
            Hl = Gl | 0;
            Gh = Fh | 0;
            Gl = Fl | 0;
            Fh = Eh | 0;
            Fl = El | 0;
            ({ h: Eh, l: El } = add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
            Dh = Ch | 0;
            Dl = Cl | 0;
            Ch = Bh | 0;
            Cl = Bl | 0;
            Bh = Ah | 0;
            Bl = Al | 0;
            const All = add3L(T1l, sigma0l, MAJl);
            Ah = add3H(All, T1h, sigma0h, MAJh);
            Al = All | 0;
          }
          ({ h: Ah, l: Al } = add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
          ({ h: Bh, l: Bl } = add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
          ({ h: Ch, l: Cl } = add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
          ({ h: Dh, l: Dl } = add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
          ({ h: Eh, l: El } = add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
          ({ h: Fh, l: Fl } = add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
          ({ h: Gh, l: Gl } = add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
          ({ h: Hh, l: Hl } = add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
          this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
        }
        roundClean() {
          clean(SHA512_W_H, SHA512_W_L);
        }
        destroy() {
          this.destroyed = true;
          clean(this.buffer);
          this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        }
      };
      _SHA512 = class extends SHA2_64B {
        constructor() {
          super(64, SHA512_IV);
        }
      };
      _SHA384 = class extends SHA2_64B {
        constructor() {
          super(48, SHA384_IV);
        }
      };
      T224_IV = /* @__PURE__ */ Uint32Array.from([
        2352822216,
        424955298,
        1944164710,
        2312950998,
        502970286,
        855612546,
        1738396948,
        1479516111,
        258812777,
        2077511080,
        2011393907,
        79989058,
        1067287976,
        1780299464,
        286451373,
        2446758561
      ]);
      T256_IV = /* @__PURE__ */ Uint32Array.from([
        573645204,
        4230739756,
        2673172387,
        3360449730,
        596883563,
        1867755857,
        2520282905,
        1497426621,
        2519219938,
        2827943907,
        3193839141,
        1401305490,
        721525244,
        746961066,
        246885852,
        2177182882
      ]);
      _SHA512_224 = class extends SHA2_64B {
        constructor() {
          super(28, T224_IV);
        }
      };
      _SHA512_256 = class extends SHA2_64B {
        constructor() {
          super(32, T256_IV);
        }
      };
      sha256 = /* @__PURE__ */ createHasher(
        () => new _SHA256(),
        /* @__PURE__ */ oidNist(1)
      );
      sha224 = /* @__PURE__ */ createHasher(
        () => new _SHA224(),
        /* @__PURE__ */ oidNist(4)
      );
      sha512 = /* @__PURE__ */ createHasher(
        () => new _SHA512(),
        /* @__PURE__ */ oidNist(3)
      );
      sha384 = /* @__PURE__ */ createHasher(
        () => new _SHA384(),
        /* @__PURE__ */ oidNist(2)
      );
      sha512_256 = /* @__PURE__ */ createHasher(
        () => new _SHA512_256(),
        /* @__PURE__ */ oidNist(6)
      );
      sha512_224 = /* @__PURE__ */ createHasher(
        () => new _SHA512_224(),
        /* @__PURE__ */ oidNist(5)
      );
    }
  });

  // src/codex-auth.js
  var require_codex_auth = __commonJS({
    "src/codex-auth.js"(exports, module) {
      "use strict";
      var sha2562 = (init_sha2(), __toCommonJS(sha2_exports)).sha256;
      var util = require_util();
      var PluginError = util.PluginError;
      var SESSION_URL = "https://chatgpt.com/api/auth/session";
      var SESSION_COOKIE = "__Secure-next-auth.session-token";
      var ISSUER = "https://auth.openai.com";
      var CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
      var REDIRECT = "http://localhost:1455/auth/callback";
      var ORIGINATOR = "Codex Desktop";
      var AUTH_KEY = "chatgpt.codex.session.v1";
      var DOT_KEY = "chatgpt-dots.connection.v1";
      var PENDING_KEY = "chatgpt.codex.pending.v1";
      var PENDING_TTL_MS = 30 * 60 * 1e3;
      var DEVICE_KEY = "chatgpt.codex.device.v1";
      var DEVICE_TTL_MS = 15 * 60 * 1e3;
      var USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
      var RENEW_BEFORE_MS = 5 * 60 * 1e3;
      var VERIFIER_BYTES = 32;
      var STATE_BYTES = 16;
      var SEED_BYTES = 48;
      var ENTROPY_BYTES = VERIFIER_BYTES + STATE_BYTES + SEED_BYTES;
      function authRequired() {
        return PluginError("AUTH_REQUIRED", "ChatGPT sign-in expired. Sign in again in plugin settings.");
      }
      function signInFirst() {
        return PluginError("AUTH_REQUIRED", "Sign in with ChatGPT in plugin settings.");
      }
      function validToken(value) {
        return typeof value === "string" && value.length > 0 && value.length <= 16384 && !/[\r\n;]/.test(value);
      }
      function accountOf(accessToken) {
        var claims = validToken(accessToken) ? util.jwtClaims(accessToken) : null;
        var auth = claims && claims["https://api.openai.com/auth"];
        if (!auth || !auth.chatgpt_account_id || typeof claims.exp !== "number") return null;
        var profile = claims["https://api.openai.com/profile"] || {};
        return {
          account: auth.chatgpt_account_id,
          user: auth.chatgpt_user_id || "",
          email: typeof profile.email === "string" ? profile.email : "",
          expiresAt: claims.exp * 1e3
        };
      }
      function createCodexAuth(storage, fetch2, now) {
        var renewing = null;
        async function load() {
          var raw = await storage.getItem(AUTH_KEY);
          var state = raw ? JSON.parse(raw) : null;
          var dotRaw = await storage.getItem(DOT_KEY);
          var dot = dotRaw ? JSON.parse(dotRaw) : null;
          if (!dot || !dot.sessionToken) return state;
          if (!state || dot.expiresAt > state.expiresAt) {
            state = {
              account: dot.account,
              user: dot.user,
              email: dot.email || "",
              expiresAt: dot.expiresAt,
              accessToken: dot.accessToken,
              sessionToken: dot.sessionToken
            };
            await storage.setItem(AUTH_KEY, JSON.stringify(state));
          }
          await storage.setItem(DOT_KEY, JSON.stringify({ account: dot.account, user: dot.user, room: dot.room, dotName: dot.dotName }));
          return state;
        }
        async function exchange(sessionToken) {
          var response = await fetch2(SESSION_URL, { headers: { "Cookie": SESSION_COOKIE + "=" + sessionToken } });
          if (response.status !== 200) throw authRequired();
          var session = await response.json();
          var signedIn = session && validToken(session.sessionToken) ? accountOf(session.accessToken) : null;
          if (!signedIn || signedIn.expiresAt - now() < 60 * 1e3) throw authRequired();
          signedIn.accessToken = session.accessToken;
          signedIn.sessionToken = session.sessionToken;
          return signedIn;
        }
        async function tokenRequest(fields) {
          var response = await fetch2(ISSUER + "/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
            body: util.form(fields)
          });
          if (response.status < 200 || response.status >= 300) throw authRequired();
          var tokens = await response.json();
          if (!tokens || !validToken(tokens.access_token)) throw authRequired();
          return tokens;
        }
        function fromTokens(tokens, previousRefresh) {
          var signedIn = accountOf(tokens.access_token);
          var refreshToken = validToken(tokens.refresh_token) ? tokens.refresh_token : previousRefresh;
          if (!signedIn || !validToken(refreshToken) || signedIn.expiresAt - now() < 60 * 1e3) throw authRequired();
          signedIn.accessToken = tokens.access_token;
          signedIn.refreshToken = refreshToken;
          return signedIn;
        }
        async function refresh(refreshToken) {
          return fromTokens(await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: CLIENT_ID }), refreshToken);
        }
        async function beginDevice() {
          var response = await fetch2(ISSUER + "/api/accounts/deviceauth/usercode", {
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
            body: JSON.stringify({ client_id: CLIENT_ID })
          });
          if (response.status !== 200) {
            throw PluginError("PLUGIN_UNAVAILABLE", "OpenAI did not start a sign-in (HTTP " + response.status + "). Try again shortly.");
          }
          var body = await response.json();
          if (!body || !validToken(body.device_auth_id) || !validToken(body.user_code)) {
            throw PluginError("PLUGIN_UNAVAILABLE", "OpenAI sent an unreadable sign-in. Try again shortly.");
          }
          await storage.setItem(DEVICE_KEY, JSON.stringify({ id: body.device_auth_id, code: body.user_code, at: now() }));
          return { code: body.user_code, url: ISSUER + "/codex/device" };
        }
        async function pollDevice() {
          var raw = await storage.getItem(DEVICE_KEY);
          var pending = raw ? JSON.parse(raw) : null;
          if (!pending || now() - pending.at > DEVICE_TTL_MS) {
            throw PluginError("AUTH_REQUIRED", "That sign-in took too long. Start signing in again.");
          }
          var response = await fetch2(ISSUER + "/api/accounts/deviceauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
            body: JSON.stringify({ device_auth_id: pending.id, user_code: pending.code })
          });
          if (response.status === 403 || response.status === 404) return null;
          if (response.status !== 200) throw authRequired();
          var grant = await response.json();
          if (!grant || !validToken(grant.authorization_code) || !validToken(grant.code_verifier)) throw authRequired();
          var tokens = await tokenRequest({
            grant_type: "authorization_code",
            code: grant.authorization_code,
            redirect_uri: ISSUER + "/deviceauth/callback",
            client_id: CLIENT_ID,
            code_verifier: grant.code_verifier
          });
          await storage.removeItem(DEVICE_KEY);
          return fromTokens(tokens);
        }
        async function adopt(state) {
          await storage.setItem(AUTH_KEY, JSON.stringify(state));
          return state;
        }
        async function connect(sessionToken) {
          if (!validToken(sessionToken)) {
            throw PluginError("AUTH_REQUIRED", "ChatGPT sign-in returned an invalid session. Please try again.");
          }
          var state = await exchange(sessionToken);
          await storage.setItem(AUTH_KEY, JSON.stringify(state));
          return state;
        }
        async function current() {
          var state = await load();
          if (!state) throw signInFirst();
          if (state.expiresAt - now() > RENEW_BEFORE_MS) return state;
          return renew();
        }
        function renew() {
          if (!renewing) {
            renewing = (async function() {
              var state = await load();
              if (!state) throw signInFirst();
              var renewed = state.refreshToken ? await refresh(state.refreshToken) : await exchange(state.sessionToken);
              if (renewed.account !== state.account || renewed.user !== state.user) throw authRequired();
              await storage.setItem(AUTH_KEY, JSON.stringify(renewed));
              return renewed;
            })().finally(function() {
              renewing = null;
            });
          }
          return renewing;
        }
        async function beginEnroll(entropy) {
          var bytes = typeof entropy === "string" ? util.fromBase64(entropy) : [];
          if (bytes.length < ENTROPY_BYTES) throw PluginError("INVALID_ARGS", "Settings page sent too little randomness.");
          var verifier = util.base64url(bytes.slice(0, VERIFIER_BYTES));
          var state = util.base64url(bytes.slice(VERIFIER_BYTES, VERIFIER_BYTES + STATE_BYTES));
          var seed = util.base64(bytes.slice(VERIFIER_BYTES + STATE_BYTES, ENTROPY_BYTES));
          await storage.setItem(PENDING_KEY, JSON.stringify({ verifier, state, seed, at: now() }));
          return {
            url: ISSUER + "/oauth/authorize?" + util.form({
              response_type: "code",
              client_id: CLIENT_ID,
              redirect_uri: REDIRECT,
              scope: "codex.remote_control.enroll",
              code_challenge: util.base64url(sha2562(util.utf8(verifier))),
              code_challenge_method: "S256",
              state,
              originator: ORIGINATOR,
              reauth: "remote_control",
              max_age: "0",
              codex_cli_simplified_flow: "true"
            })
          };
        }
        async function finishEnroll(callbackUrl) {
          var raw = await storage.getItem(PENDING_KEY);
          var pending = raw ? JSON.parse(raw) : null;
          if (!pending || now() - pending.at > PENDING_TTL_MS) {
            throw PluginError("AUTH_REQUIRED", "That sign-in took too long. Start connecting again.");
          }
          var text = typeof callbackUrl === "string" ? callbackUrl.trim() : "";
          var query = text.indexOf("?") >= 0 ? text.slice(text.indexOf("?") + 1).split("#")[0] : "";
          var params = {};
          query.split("&").forEach(function(pair) {
            var eq = pair.indexOf("=");
            if (eq > 0) params[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, " "));
          });
          if (params.error) throw PluginError("AUTH_REQUIRED", params.error_description || "Sign-in was refused.");
          if (!params.code || params.state !== pending.state) {
            throw PluginError("INVALID_ARGS", "Paste the whole address the browser ended on, starting with http://localhost:1455.");
          }
          var response = await fetch2(ISSUER + "/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: util.form({
              grant_type: "authorization_code",
              code: params.code,
              redirect_uri: REDIRECT,
              client_id: CLIENT_ID,
              code_verifier: pending.verifier
            })
          });
          if (response.status < 200 || response.status >= 300) {
            throw PluginError("AUTH_REQUIRED", "OpenAI did not accept that sign-in (HTTP " + response.status + "). Start connecting again.");
          }
          var tokens = await response.json();
          if (!tokens || !tokens.access_token) throw PluginError("AUTH_REQUIRED", "OpenAI did not return a sign-in. Start connecting again.");
          await storage.removeItem(PENDING_KEY);
          return { stepUpToken: tokens.access_token, seed: util.fromBase64(pending.seed) };
        }
        async function signOut() {
          await storage.removeItem(AUTH_KEY);
          await storage.removeItem(PENDING_KEY);
          await storage.removeItem(DEVICE_KEY);
        }
        return {
          beginDevice,
          pollDevice,
          adopt,
          load,
          connect,
          current,
          renew,
          beginEnroll,
          finishEnroll,
          signOut
        };
      }
      function codexHeaders(state) {
        return {
          "Authorization": "Bearer " + state.accessToken,
          "ChatGPT-Account-Id": state.account,
          "originator": ORIGINATOR,
          "Content-Type": "application/json"
        };
      }
      module.exports = { createCodexAuth, codexHeaders, ENTROPY_BYTES };
    }
  });

  // node_modules/@noble/curves/utils.js
  function aarray(item, title, inner = () => {
  }) {
    if (!Array.isArray(item))
      throw new TypeError(`"${title}" expected array, got type=${typeof item}`);
    for (let i = 0; i < item.length; i++)
      inner(item[i], `${title}[${i}]`);
    return item;
  }
  function astring(value, title = "") {
    if (typeof value !== "string") {
      const prefix = title && `"${title}" `;
      throw new TypeError(prefix + "expected string, got type=" + typeof value);
    }
    return value;
  }
  function aobject2(value, title = "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new TypeError(title === "object" ? "expected valid options object" : `"${title}" expected object, got type=${typeof value}`);
    return value;
  }
  function afunction(value, title) {
    if (typeof value !== "function")
      throw new TypeError(`"${title}" is invalid: expected function, got ${typeof value}`);
    return value;
  }
  function abool2(value, title = "") {
    if (typeof value !== "boolean")
      throw new TypeError(atitle2(title) + "expected boolean, got type=" + typeof value);
    return value;
  }
  function abignumber(n) {
    if (typeof n === "bigint") {
      if (!isPosBig(n))
        throw new RangeError("positive bigint expected, got " + n);
    } else
      anumber2(n);
    return n;
  }
  function asafenumber(value, title = "") {
    if (typeof value !== "number") {
      const prefix = title && `"${title}" `;
      throw new TypeError(prefix + "expected number, got type=" + typeof value);
    }
    if (!Number.isSafeInteger(value)) {
      const prefix = title && `"${title}" `;
      throw new RangeError(prefix + "expected safe integer, got " + value);
    }
  }
  function numberToHexUnpadded(num) {
    const hex = abignumber(num).toString(16);
    return hex.length & 1 ? "0" + hex : hex;
  }
  function hexToNumber(hex) {
    if (typeof hex !== "string")
      throw new TypeError("hex string expected, got " + typeof hex);
    return hex === "" ? _0n : BigInt("0x" + hex);
  }
  function bytesToNumberBE(bytes) {
    return hexToNumber(bytesToHex(bytes));
  }
  function bytesToNumberLE(bytes) {
    return hexToNumber(bytesToHex(copyBytes(abytes(bytes)).reverse()));
  }
  function numberToBytesBE(n, len) {
    anumber(len);
    if (len === 0)
      throw new Error("zero output length is invalid");
    n = abignumber(n);
    const expectedLen = len * 2;
    const hex = n.toString(16);
    if (hex.length > expectedLen)
      throw new RangeError("number is too large");
    return hexToBytes(hex.padStart(expectedLen, "0"));
  }
  function numberToBytesLE(n, len) {
    return numberToBytesBE(n, len).reverse();
  }
  function equalBytes(a, b) {
    a = abytes2(a);
    b = abytes2(b);
    if (a.length !== b.length)
      return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
      diff |= a[i] ^ b[i];
    return diff === 0;
  }
  function copyBytes(bytes) {
    return Uint8Array.from(abytes2(bytes));
  }
  function asciiToBytes(ascii) {
    if (typeof ascii !== "string")
      throw new TypeError("ascii string expected, got " + typeof ascii);
    return Uint8Array.from(ascii, (c, i) => {
      const charCode = c.charCodeAt(0);
      if (c.length !== 1 || charCode > 127) {
        throw new RangeError(`string contains non-ASCII character "${ascii[i]}" with code ${charCode} at position ${i}`);
      }
      return charCode;
    });
  }
  function isPosBig(n) {
    return typeof n === "bigint" && _0n <= n;
  }
  function inRange(n, min, max) {
    return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
  }
  function aInRange(title, n, min, max) {
    if (!inRange(n, min, max))
      throw new RangeError("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
  }
  function bitLen(n) {
    if (n < _0n)
      throw new Error("expected non-negative bigint, got " + n);
    return n === _0n ? 0 : n.toString(2).length;
  }
  function createHmacDrbg(hashLen, qByteLen, hmacFn) {
    anumber(hashLen, "hashLen");
    anumber(qByteLen, "qByteLen");
    if (typeof hmacFn !== "function")
      throw new TypeError("hmacFn must be a function");
    const u8n = (len) => new Uint8Array(len);
    const NULL = Uint8Array.of();
    const byte0 = Uint8Array.of(0);
    const byte1 = Uint8Array.of(1);
    const _maxDrbgIters = 1e3;
    let v = u8n(hashLen);
    let k = u8n(hashLen);
    let i = 0;
    const reset = () => {
      v.fill(1);
      k.fill(0);
      i = 0;
    };
    const h = (...msgs) => hmacFn(k, concatBytes2(v, ...msgs));
    const reseed = (seed = NULL) => {
      k = h(byte0, seed);
      v = h();
      if (seed.length === 0)
        return;
      k = h(byte1, seed);
      v = h();
    };
    const gen = () => {
      if (i++ >= _maxDrbgIters)
        throw new Error("drbg: tried max amount of iterations");
      let len = 0;
      const out = [];
      while (len < qByteLen) {
        v = h();
        const sl = v.slice();
        out.push(sl);
        len += v.length;
      }
      return concatBytes2(...out);
    };
    const genUntil = (seed, pred) => {
      reset();
      reseed(seed);
      let res = void 0;
      while ((res = pred(gen())) === void 0)
        reseed();
      reset();
      return res;
    };
    return genUntil;
  }
  function validateObject(object, fields = {}, optFields = {}, title = "object") {
    aobject2(object, title);
    aobject2(fields, "fields");
    aobject2(optFields, "optFields");
    function checkField(fieldName, expectedType, isOpt) {
      const label = title === "object" ? `param "${String(fieldName)}"` : `"${title}.${String(fieldName)}"`;
      const val = object[fieldName];
      if (!Object.hasOwn(object, fieldName) && (isOpt ? val !== void 0 : expectedType !== "function")) {
        throw new TypeError(`${label} is invalid: expected own property`);
      }
      if (isOpt && val === void 0)
        return;
      const current = typeof val;
      if (current !== expectedType || val === null)
        throw new TypeError(`${label} is invalid: expected ${expectedType}, got ${current}`);
    }
    const iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
    iter(fields, false);
    iter(optFields, true);
  }
  var abytes2, anumber2, bytesToHex2, concatBytes2, hexToBytes2, isBytes2, randomBytes2, _0n, _1n, atitle2, bitMask;
  var init_utils2 = __esm({
    "node_modules/@noble/curves/utils.js"() {
      init_utils();
      abytes2 = (value, length, title) => abytes(value, length, title);
      anumber2 = anumber;
      bytesToHex2 = bytesToHex;
      concatBytes2 = (...arrays) => concatBytes(...arrays);
      hexToBytes2 = (hex) => hexToBytes(hex);
      isBytes2 = isBytes;
      randomBytes2 = (bytesLength) => randomBytes(bytesLength);
      _0n = /* @__PURE__ */ BigInt(0);
      _1n = /* @__PURE__ */ BigInt(1);
      atitle2 = (title) => title ? `"${title}" ` : "";
      bitMask = (n) => {
        asafenumber(n, "n");
        return (_1n << BigInt(n)) - _1n;
      };
    }
  });

  // node_modules/@noble/curves/abstract/modular.js
  function mod(a, b) {
    if (b <= _0n2)
      throw new Error("mod: expected positive modulus, got " + b);
    const result = a % b;
    return result >= _0n2 ? result : b + result;
  }
  function pow(num, power, modulo) {
    if (modulo <= _1n2)
      throw new Error("pow: expected modulus > 1, got " + modulo);
    if (typeof power !== "bigint")
      throw new TypeError("invalid exponent: expected bigint, got " + typeof power);
    if (power < _0n2)
      throw new Error("invalid exponent, negatives unsupported");
    if (power === _0n2)
      return _1n2;
    if (power === _1n2)
      return num;
    let d = num % modulo;
    if (d < _0n2)
      d += modulo;
    if (power < POW_WINDOWED_MIN) {
      let p2 = _1n2;
      while (power > _0n2) {
        if (power & _1n2)
          p2 = p2 * d % modulo;
        d = d * d % modulo;
        power >>= _1n2;
      }
      return p2;
    }
    const digits = [];
    while (power > _0n2) {
      digits.push(Number(power & _15n));
      power >>= _4n;
    }
    const table = new Array(16);
    table[0] = _1n2;
    table[1] = d;
    for (let i = 2; i < 16; i++)
      table[i] = table[i - 1] * d % modulo;
    let p = table[digits[digits.length - 1]];
    for (let w = digits.length - 2; w >= 0; w--) {
      p = p * p % modulo;
      p = p * p % modulo;
      p = p * p % modulo;
      p = p * p % modulo;
      const digit = digits[w];
      if (digit !== 0)
        p = p * table[digit] % modulo;
    }
    return p;
  }
  function invert(number, modulo) {
    if (number === _0n2)
      throw new Error("invert: expected non-zero number");
    if (modulo <= _1n2)
      throw new Error("invert: expected modulus > 1, got " + modulo);
    let a = mod(number, modulo);
    let b = modulo;
    let x = _0n2, u = _1n2;
    while (a !== _0n2) {
      const q = b / a;
      const r = b - a * q;
      const m = x - u * q;
      b = a, a = r, x = u, u = m;
    }
    const gcd = b;
    if (gcd !== _1n2)
      throw new Error("invert: does not exist");
    return mod(x, modulo);
  }
  function invertCt(a, prime) {
    if (prime <= _1n2)
      throw new Error("invertCt: expected prime modulus > 1, got " + prime);
    const an = mod(a, prime);
    if (an === _0n2)
      throw new Error("invertCt: expected non-zero number");
    const inverse = pow(an, prime - _2n, prime);
    if (mod(an * inverse, prime) !== _1n2)
      throw new Error("invertCt: does not exist");
    return inverse;
  }
  function assertIsSquare(Fp, root, n) {
    const F = Fp;
    if (!F.eql(F.sqr(root), n))
      throw new Error("Cannot find square root");
  }
  function aoddModulus(order, fnName) {
    if ((order & _1n2) === _0n2)
      throw new Error(fnName + ": expected odd modulus, got " + order);
  }
  function sqrt3mod4(Fp, n) {
    const F = Fp;
    const p1div4 = (F.ORDER + _1n2) / _4n;
    const root = F.pow(n, p1div4);
    assertIsSquare(F, root, n);
    return root;
  }
  function sqrt5mod8(Fp, n) {
    const F = Fp;
    const p5div8 = (F.ORDER - _5n) / _8n;
    const n2 = F.mul(n, _2n);
    const v = F.pow(n2, p5div8);
    const nv = F.mul(n, v);
    const i = F.mul(F.mul(nv, _2n), v);
    const root = F.mul(nv, F.sub(i, F.ONE));
    assertIsSquare(F, root, n);
    return root;
  }
  function sqrt9mod16(P) {
    const Fp_ = Field(P);
    const tn = tonelliShanks(P);
    const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
    const c2 = tn(Fp_, c1);
    const c3 = tn(Fp_, Fp_.neg(c1));
    const c4 = (P + _7n) / _16n;
    return ((Fp, n) => {
      const F = Fp;
      let tv1 = F.pow(n, c4);
      let tv2 = F.mul(tv1, c1);
      const tv3 = F.mul(tv1, c2);
      const tv4 = F.mul(tv1, c3);
      const e1 = F.eql(F.sqr(tv2), n);
      const e2 = F.eql(F.sqr(tv3), n);
      tv1 = F.cmov(tv1, tv2, e1);
      tv2 = F.cmov(tv4, tv3, e2);
      const e3 = F.eql(F.sqr(tv2), n);
      const root = F.cmov(tv1, tv2, e3);
      assertIsSquare(F, root, n);
      return root;
    });
  }
  function tonelliShanks(P) {
    if (P < _3n)
      throw new Error("sqrt is not defined for small field");
    aoddModulus(P, "tonelliShanks");
    let Q = P - _1n2;
    let S = 0;
    while (Q % _2n === _0n2) {
      Q /= _2n;
      S++;
    }
    let Z = _2n;
    const _Fp = Field(P);
    while (FpLegendre(_Fp, Z) === 1) {
      if (Z++ > 1e3)
        throw new Error("Cannot find square root: probably non-prime P");
    }
    if (S === 1)
      return sqrt3mod4;
    let cc = _Fp.pow(Z, Q);
    const Q1div2 = (Q + _1n2) / _2n;
    return function tonelliSlow(Fp, n) {
      const F = Fp;
      if (F.is0(n))
        return n;
      if (FpLegendre(F, n) !== 1)
        throw new Error("Cannot find square root");
      let M = S;
      let c = F.mul(F.ONE, cc);
      let t = F.pow(n, Q);
      let R = F.pow(n, Q1div2);
      while (!F.eql(t, F.ONE)) {
        if (F.is0(t))
          throw new Error("Cannot find square root: probably non-prime P");
        let i = 1;
        let t_tmp = F.sqr(t);
        while (!F.eql(t_tmp, F.ONE)) {
          i++;
          t_tmp = F.sqr(t_tmp);
          if (i === M)
            throw new Error("Cannot find square root");
        }
        const exponent = _1n2 << BigInt(M - i - 1);
        const b = F.pow(c, exponent);
        M = i;
        c = F.sqr(b);
        t = F.mul(t, c);
        R = F.mul(R, b);
      }
      return R;
    };
  }
  function FpSqrt(P) {
    aoddModulus(P, "Fp.sqrt");
    if (P % _4n === _3n)
      return sqrt3mod4;
    if (P % _8n === _5n)
      return sqrt5mod8;
    if (P % _16n === _9n)
      return sqrt9mod16(P);
    return tonelliShanks(P);
  }
  function validateField(field) {
    aobject2(field, "field");
    if (typeof field.ORDER !== "bigint")
      throw new TypeError('param "ORDER" is invalid: expected bigint, got ' + typeof field.ORDER);
    asafenumber(field.BYTES, "BYTES");
    asafenumber(field.BITS, "BITS");
    for (const name of FIELD_FIELDS)
      afunction(field[name], "field." + name);
    if (field.BYTES < 1 || field.BITS < 1)
      throw new Error("invalid field: expected BYTES/BITS > 0");
    if (field.ORDER <= _1n2)
      throw new Error("invalid field: expected ORDER > 1, got " + field.ORDER);
    return field;
  }
  function FpInvertBatch(Fp, nums, passZero = false) {
    validateField(Fp);
    aarray(nums, "nums");
    abool2(passZero, "passZero");
    const F = Fp;
    const inverted = new Array(nums.length).fill(passZero ? F.ZERO : void 0);
    const multipliedAcc = nums.reduce((acc, num, i) => {
      if (F.is0(num))
        return acc;
      inverted[i] = acc;
      return F.mul(acc, num);
    }, F.ONE);
    const invertedAcc = F.inv(multipliedAcc);
    nums.reduceRight((acc, num, i) => {
      if (F.is0(num))
        return acc;
      inverted[i] = F.mul(acc, inverted[i]);
      return F.mul(acc, num);
    }, invertedAcc);
    return inverted;
  }
  function FpLegendre(Fp, n) {
    validateField(Fp);
    const F = Fp;
    aoddModulus(F.ORDER, "FpLegendre");
    const p1mod2 = (F.ORDER - _1n2) / _2n;
    const powered = F.pow(n, p1mod2);
    const yes = F.eql(powered, F.ONE);
    const zero = F.eql(powered, F.ZERO);
    const no = F.eql(powered, F.neg(F.ONE));
    if (!yes && !zero && !no)
      throw new Error("invalid Legendre symbol result");
    return yes ? 1 : zero ? 0 : -1;
  }
  function FpIsSquare(Fp, n) {
    const l = FpLegendre(Fp, n);
    return l !== -1;
  }
  function nLength(n, nBitLength) {
    if (nBitLength !== void 0)
      anumber2(nBitLength);
    if (n <= _0n2)
      throw new Error("invalid n length: expected positive n, got " + n);
    if (nBitLength !== void 0 && nBitLength < 1)
      throw new Error("invalid n length: expected positive bit length, got " + nBitLength);
    const bits = bitLen(n);
    if (nBitLength !== void 0 && nBitLength < bits)
      throw new Error(`invalid n length: expected nBitLength (${nBitLength}) >= bitLen(n) (${bits})`);
    const _nBitLength = nBitLength !== void 0 ? nBitLength : bits;
    const nByteLength = Math.ceil(_nBitLength / 8);
    return { nBitLength: _nBitLength, nByteLength };
  }
  function Field(ORDER, opts = {}) {
    Object.freeze(_Field.prototype);
    return new _Field(ORDER, opts);
  }
  function getFieldBytesLength(fieldOrder) {
    if (typeof fieldOrder !== "bigint")
      throw new Error("field order must be bigint");
    if (fieldOrder <= _1n2)
      throw new Error("field order must be greater than 1");
    const bitLength = bitLen(fieldOrder - _1n2);
    return Math.ceil(bitLength / 8);
  }
  function getMinHashLength(fieldOrder) {
    const length = getFieldBytesLength(fieldOrder);
    return length + Math.ceil(length / 2);
  }
  function mapHashToField(key, fieldOrder, isLE2 = false) {
    abytes2(key);
    const len = key.length;
    const fieldLen = getFieldBytesLength(fieldOrder);
    const minLen = Math.max(getMinHashLength(fieldOrder), 16);
    if (len < minLen || len > 1024)
      throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
    const num = isLE2 ? bytesToNumberLE(key) : bytesToNumberBE(key);
    const reduced = mod(num, fieldOrder - _1n2) + _1n2;
    return isLE2 ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
  }
  var _0n2, _1n2, _2n, _3n, _4n, _5n, _7n, _8n, _9n, _15n, _16n, POW_WINDOWED_MIN, FIELD_FIELDS, FIELD_SQRT, _Field;
  var init_modular = __esm({
    "node_modules/@noble/curves/abstract/modular.js"() {
      init_utils2();
      _0n2 = /* @__PURE__ */ BigInt(0);
      _1n2 = /* @__PURE__ */ BigInt(1);
      _2n = /* @__PURE__ */ BigInt(2);
      _3n = /* @__PURE__ */ BigInt(3);
      _4n = /* @__PURE__ */ BigInt(4);
      _5n = /* @__PURE__ */ BigInt(5);
      _7n = /* @__PURE__ */ BigInt(7);
      _8n = /* @__PURE__ */ BigInt(8);
      _9n = /* @__PURE__ */ BigInt(9);
      _15n = /* @__PURE__ */ BigInt(15);
      _16n = /* @__PURE__ */ BigInt(16);
      POW_WINDOWED_MIN = /* @__PURE__ */ BigInt("0x10000000000000000");
      FIELD_FIELDS = [
        "create",
        "isValid",
        "is0",
        "neg",
        "inv",
        "sqrt",
        "sqr",
        "eql",
        "add",
        "sub",
        "mul",
        "pow",
        "div",
        "addN",
        "subN",
        "mulN",
        "sqrN"
      ];
      FIELD_SQRT = /* @__PURE__ */ new WeakMap();
      _Field = class {
        constructor(ORDER, opts = {}) {
          __publicField(this, "ORDER");
          __publicField(this, "BITS");
          __publicField(this, "BYTES");
          __publicField(this, "isLE");
          __publicField(this, "ZERO", _0n2);
          __publicField(this, "ONE", _1n2);
          __publicField(this, "_lengths");
          __publicField(this, "_mod");
          if (ORDER <= _1n2)
            throw new Error("invalid field: expected ORDER > 1, got " + ORDER);
          let _nbitLength = void 0;
          this.isLE = false;
          if (opts != null && typeof opts === "object") {
            if (typeof opts.BITS === "number")
              _nbitLength = opts.BITS;
            if (typeof opts.sqrt === "function")
              Object.defineProperty(this, "sqrt", { value: opts.sqrt, enumerable: true });
            if (typeof opts.isLE === "boolean")
              this.isLE = opts.isLE;
            if (opts.allowedLengths)
              this._lengths = Object.freeze(opts.allowedLengths.slice());
            if (typeof opts.modFromBytes === "boolean")
              this._mod = opts.modFromBytes;
          }
          const { nBitLength, nByteLength } = nLength(ORDER, _nbitLength);
          if (nByteLength > 2048)
            throw new Error("invalid field: expected ORDER of <= 2048 bytes");
          this.ORDER = ORDER;
          this.BITS = nBitLength;
          this.BYTES = nByteLength;
          Object.freeze(this);
        }
        create(num) {
          return mod(num, this.ORDER);
        }
        isValid(num) {
          if (typeof num !== "bigint")
            throw new TypeError("invalid field element: expected bigint, got " + typeof num);
          return _0n2 <= num && num < this.ORDER;
        }
        is0(num) {
          return num === _0n2;
        }
        // is valid and invertible
        isValidNot0(num) {
          return !this.is0(num) && this.isValid(num);
        }
        isOdd(num) {
          return (num & _1n2) === _1n2;
        }
        neg(num) {
          return mod(-num, this.ORDER);
        }
        eql(lhs, rhs) {
          return lhs === rhs;
        }
        sqr(num) {
          return mod(num * num, this.ORDER);
        }
        add(lhs, rhs) {
          return mod(lhs + rhs, this.ORDER);
        }
        sub(lhs, rhs) {
          return mod(lhs - rhs, this.ORDER);
        }
        mul(lhs, rhs) {
          return mod(lhs * rhs, this.ORDER);
        }
        pow(num, power) {
          return pow(num, power, this.ORDER);
        }
        div(lhs, rhs) {
          return mod(lhs * invert(rhs, this.ORDER), this.ORDER);
        }
        // Same as above, but doesn't normalize
        sqrN(num) {
          return num * num;
        }
        addN(lhs, rhs) {
          return lhs + rhs;
        }
        subN(lhs, rhs) {
          return lhs - rhs;
        }
        mulN(lhs, rhs) {
          return lhs * rhs;
        }
        inv(num) {
          return invert(num, this.ORDER);
        }
        sqrt(num) {
          let sqrt = FIELD_SQRT.get(this);
          if (!sqrt)
            FIELD_SQRT.set(this, sqrt = FpSqrt(this.ORDER));
          return sqrt(this, num);
        }
        toBytes(num) {
          return this.isLE ? numberToBytesLE(num, this.BYTES) : numberToBytesBE(num, this.BYTES);
        }
        fromBytes(bytes, skipValidation = false) {
          abytes2(bytes);
          const { _lengths: allowedLengths, BYTES, isLE: isLE2, ORDER, _mod: modFromBytes } = this;
          if (allowedLengths) {
            if (bytes.length < 1 || !allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
              throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
            }
            const padded = new Uint8Array(BYTES);
            padded.set(bytes, isLE2 ? 0 : padded.length - bytes.length);
            bytes = padded;
          }
          if (bytes.length !== BYTES)
            throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
          let scalar = isLE2 ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
          if (modFromBytes)
            scalar = mod(scalar, ORDER);
          if (!skipValidation) {
            if (!this.isValid(scalar))
              throw new Error("invalid field element: outside of range 0..ORDER");
          }
          return scalar;
        }
        // TODO: we don't need it here, move out to separate fn
        invertBatch(lst) {
          return FpInvertBatch(this, lst, true);
        }
        // We can't move this out because Fp6, Fp12 implement it
        // and it's unclear what to return in there.
        cmov(a, b, condition) {
          abool2(condition, "condition");
          return condition ? b : a;
        }
      };
    }
  });

  // node_modules/@noble/curves/abstract/curve.js
  function validatePointCons(Point) {
    const pc = Point;
    if (typeof pc !== "function")
      throw new TypeError('"Point" expected constructor, got type=' + typeof Point);
    afunction(pc.fromAffine, "Point.fromAffine");
    afunction(pc.fromBytes, "Point.fromBytes");
    afunction(pc.fromHex, "Point.fromHex");
    aobject2(pc.BASE, "Point.BASE");
    aobject2(pc.ZERO, "Point.ZERO");
    validateField(pc.Fp);
    validateField(pc.Fn);
  }
  function normalizeZ(c, points) {
    validatePointCons(c);
    validateMSMPoints(points, c);
    const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
    return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
  }
  function validateW(W, bits, min = 1) {
    if (!Number.isSafeInteger(W) || W < min || W > bits)
      throw new Error("invalid window size, expected [" + min + ".." + bits + "], got W=" + W);
  }
  function validateTableBytes(numPoints, fpBytes) {
    const bytes = numPoints * (4 * fpBytes + 128);
    if (bytes > TABLE_BYTES_MAX)
      throw new Error("invalid window size: table would need ~" + Math.ceil(bytes / 2 ** 20) + " MiB, max " + TABLE_BYTES_MAX / 2 ** 20 + " MiB");
  }
  function probeRandomBytes(randomBytes3, length) {
    if (randomBytes3 === void 0)
      return void 0;
    afunction(randomBytes3, "randomBytes");
    try {
      const probe = randomBytes3(length);
      if (!isBytes2(probe) || probe.length !== length)
        return void 0;
    } catch {
      return void 0;
    }
    return randomBytes3;
  }
  function validateMSMPoints(points, c) {
    aarray(points, "points");
    points.forEach((p, i) => {
      if (!(p instanceof c))
        throw new Error("invalid point at index " + i);
    });
  }
  function validateMSMScalars(scalars, field, maxScalar) {
    if (!Array.isArray(scalars))
      throw new Error("array of scalars expected");
    scalars.forEach((s, i) => {
      const ok = maxScalar === void 0 ? field.isValid(s) : isPosBig(s) && s < maxScalar;
      if (!ok)
        throw new Error("invalid scalar at index " + i);
    });
  }
  function getWindowSize(P) {
    return pointWindowSizes.get(P) || 1;
  }
  function oddMultiples(p, size) {
    const dbl = p.double();
    const t = [p];
    for (let j = 1; j < size; j++)
      t.push(t[j - 1].add(dbl));
    return t;
  }
  function wnafDigits(n, W) {
    const size = 2 ** W;
    const half = size / 2;
    const mask = BigInt(size - 1);
    const d = [];
    while (n > _0n3) {
      let w = 0;
      if (n & _1n3) {
        w = Number(n & mask);
        if (w >= half)
          w -= size;
        n -= BigInt(w);
      }
      d.push(w);
      n >>= _1n3;
    }
    return d;
  }
  function signedWindowDigits(n, W, windows) {
    const size = 2 ** W;
    const half = size / 2;
    const mask = BigInt(size - 1);
    const shiftBy = BigInt(W);
    const d = [];
    for (let w = 0; w < windows; w++) {
      let v = Number(n & mask);
      n >>= shiftBy;
      if (v > half) {
        v -= size;
        n += _1n3;
      }
      d.push(v);
    }
    if (n !== _0n3)
      throw new Error("invalid wnaf");
    return d;
  }
  function wnafWalk(zero, tables, digits) {
    let max = 0;
    for (const d of digits)
      max = Math.max(max, d.length);
    let acc = zero;
    for (let bit = max - 1; bit >= 0; bit--) {
      if (bit !== max - 1)
        acc = acc.double();
      for (let i = 0; i < digits.length; i++) {
        const w = digits[i][bit];
        if (w) {
          const item = tables[i][Math.abs(w) - 1 >> 1];
          acc = acc.add(w < 0 ? item.negate() : item);
        }
      }
    }
    return acc;
  }
  function mulAddUnsafe(c, points, scalars, allowOversized = false) {
    validatePointCons(c);
    validateMSMPoints(points, c);
    abool2(allowOversized, "allowOversized");
    validateMSMScalars(scalars, c.Fn, allowOversized ? c.Fn.ORDER ** _4n2 : void 0);
    if (points.length !== scalars.length)
      throw new Error("arrays of points and scalars must have equal length");
    const tables = points.map((p) => oddMultiples(p, 4));
    const digits = scalars.map((n) => wnafDigits(n, 4));
    return wnafWalk(c.ZERO, tables, digits);
  }
  function createField(order, field, isLE2) {
    if (field) {
      if (field.ORDER !== order)
        throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
      validateField(field);
      return field;
    } else {
      return Field(order, { isLE: isLE2 });
    }
  }
  function createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
    if (type !== "weierstrass" && type !== "edwards")
      throw new Error('expected curve type "weierstrass" or "edwards"');
    if (FpFnLE === void 0)
      FpFnLE = type === "edwards";
    if (!CURVE || typeof CURVE !== "object")
      throw new Error(`expected valid ${type} CURVE object`);
    validateObject(curveOpts);
    for (const p of ["p", "n", "h"]) {
      const val = CURVE[p];
      if (!(isPosBig(val) && val !== _0n3))
        throw new Error(`CURVE.${p} must be positive bigint`);
    }
    const Fp = createField(CURVE.p, curveOpts.Fp, FpFnLE);
    const Fn = createField(CURVE.n, curveOpts.Fn, FpFnLE);
    const _b = type === "weierstrass" ? "b" : "d";
    const params = ["Gx", "Gy", "a", _b];
    for (const p of params) {
      if (!Fp.isValid(CURVE[p]))
        throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
    }
    CURVE = Object.freeze(Object.assign({}, CURVE));
    return { CURVE, Fp, Fn };
  }
  function createKeygen(randomSecretKey, getPublicKey) {
    return function keygen(seed) {
      const secretKey = randomSecretKey(seed);
      return { secretKey, publicKey: getPublicKey(secretKey) };
    };
  }
  var _0n3, _1n3, _4n2, BLIND_BYTES, BLIND_BITS, FW_WINDOW, TABLE_BYTES_MAX, pointWindowSizes, ScalarMultiplier;
  var init_curve = __esm({
    "node_modules/@noble/curves/abstract/curve.js"() {
      init_utils2();
      init_modular();
      _0n3 = /* @__PURE__ */ BigInt(0);
      _1n3 = /* @__PURE__ */ BigInt(1);
      _4n2 = /* @__PURE__ */ BigInt(4);
      BLIND_BYTES = 16;
      BLIND_BITS = 128;
      FW_WINDOW = 5;
      TABLE_BYTES_MAX = /* @__PURE__ */ (() => 2 ** 31)();
      pointWindowSizes = /* @__PURE__ */ new WeakMap();
      ScalarMultiplier = class {
        // Parametrized with a given Point class (not individual point)
        constructor(Point, randomBytes3) {
          __publicField(this, "Point");
          __publicField(this, "BASE");
          __publicField(this, "ZERO");
          __publicField(this, "randomBytes");
          __publicField(this, "wnafPrecomputes", /* @__PURE__ */ new WeakMap());
          __publicField(this, "baseCanBeBlinded");
          __publicField(this, "bits");
          validatePointCons(Point);
          this.randomBytes = probeRandomBytes(randomBytes3, BLIND_BYTES);
          this.Point = Point;
          this.BASE = Point.BASE;
          this.ZERO = Point.ZERO;
          this.bits = Point.Fn.BITS;
        }
        /**
         * Creates a signed fixed-window wNAF precomputation table: for every window w, the
         * multiples `[1..2^(W−1)]⋅2^(w⋅W)⋅P`, flattened. All doublings are baked into the table,
         * so cached multiplication is additions-only. `windows = ceil(bits/W) + 1`: the extra
         * window absorbs the final carry of signed-digit recoding.
         * For a 256-bit curve and W=6, the table is 44⋅32 = 1408 points.
         * @param point - Point instance
         * @param W - window size
         * @param bits - scalar bitlength the table must cover
         */
        buildWnafTable(point, W, bits) {
          const windows = Math.ceil(bits / W) + 1;
          const half = 2 ** (W - 1);
          const comp = [];
          let base = point;
          for (let w = 0; w < windows; w++) {
            let acc = base;
            for (let i = 0; i < half; i++) {
              comp.push(acc);
              acc = acc.add(base);
            }
            base = comp[comp.length - 1].double();
          }
          return { W, bits, windows, comp };
        }
        /**
         * Implements ec multiplication using precomputed signed fixed-window wNAF tables.
         * Constant-time: fixed window count with one table addition per window — zero digits feed
         * the fake accumulator — and no doublings; the lookup scans the whole window slice.
         * Scalar bounds are validated by the public entry points ({@link ScalarMultiplier.mulCT},
         * {@link ScalarMultiplier.mulCTBlinded}, {@link ScalarMultiplier.mulUnsafe});
         * signedWindowDigits throws if `n` exceeds the table.
         * @returns real and fake (for const-time) points
         */
        wnafCachedCT(precomputes, n) {
          const { W, windows, comp } = precomputes;
          const half = 2 ** (W - 1);
          const digits = signedWindowDigits(n, W, windows);
          let p = this.ZERO;
          let f = this.BASE;
          for (let w = 0; w < windows; w++) {
            const digit = digits[w];
            const start = w * half;
            const idx = Math.abs(digit) - 1;
            let sel = comp[start];
            for (let i = 1; i < half; i++)
              sel = i === idx ? comp[start + i] : sel;
            const neg = sel.negate();
            if (digit === 0)
              f = f.add(comp[start]);
            else
              p = p.add(digit < 0 ? neg : sel);
          }
          return { p, f };
        }
        // Cache key is point identity plus (W, bits); at most two entries exist per point (public-width
        // `Fn.BITS` and blinded `Fn.BITS + BLIND_BITS`). Callers must not reuse the same point with
        // incompatible `transform(...)` layouts and expect a separate cache entry.
        getWnafPrecomputes(W, point, bits, transform) {
          let entries = this.wnafPrecomputes.get(point);
          let comp = entries?.find((entry) => entry.W === W && entry.bits === bits);
          if (!comp) {
            comp = this.buildWnafTable(point, W, bits);
            if (typeof transform === "function")
              comp = { ...comp, comp: transform(comp.comp) };
            if (!entries) {
              entries = [];
              this.wnafPrecomputes.set(point, entries);
            }
            entries.push(comp);
          }
          return comp;
        }
        assertPoint(point) {
          if (!(point instanceof this.Point))
            throw new TypeError('"point" expected Point instance, got type=' + typeof point);
        }
        // Shared prologue of the constant-time entry points. Rejects scalar 0: in key/signature-style
        // callers a zero scalar means broken upstream plumbing, and concrete Points already reject it.
        // Uses inRange instead of Fn.isValidNot0: validateField() only certifies the arithmetic subset.
        validateMulInput(point, scalar) {
          this.assertPoint(point);
          if (!inRange(scalar, _1n3, this.Point.Fn.ORDER))
            throw new Error("invalid scalar");
        }
        // Constant-time dispatch shared by mulCT / mulCTBlinded. Un-precomputed points (W===1, e.g.
        // ECDH peer keys) skip building a throwaway cached table in favor of a small fixed-window
        // multiply. `n` must be < 2^bits.
        runCT(point, n, bits, transform) {
          const W = getWindowSize(point);
          if (W === 1)
            return this.fixedWindowCT(point, n, bits);
          return this.wnafCachedCT(this.getWnafPrecomputes(W, point, bits, transform), n);
        }
        mulCT(point, scalar, transform) {
          this.validateMulInput(point, scalar);
          return this.runCT(point, scalar, this.bits, transform);
        }
        mulCTBlinded(point, scalar, transform) {
          this.validateMulInput(point, scalar);
          if (this.randomBytes === void 0)
            throw new Error("randomBytes is required for scalar blinding");
          const bits = this.Point.Fn.BITS + BLIND_BITS;
          const blind = this.randomBytes(BLIND_BYTES);
          if (!isBytes2(blind) || blind.length !== BLIND_BYTES)
            throw new Error("randomBytes returned invalid byte array");
          blind[0] = blind[0] & 63 | 128;
          const n = scalar + bytesToNumberBE(blind) * this.Point.Fn.ORDER;
          return this.runCT(point, n, bits, transform);
        }
        /**
         * Constant-time multiplication `n*point` for an un-precomputed point, via a small fixed window.
         * A cached wNAF table only pays off when reused; a flat 2^FW_WINDOW table (`size-1` adds) is
         * far cheaper to build for a single use. The point-operation sequence is independent of `n`:
         * build the table, then per window exactly FW_WINDOW doublings, a data-oblivious scan over
         * every table entry, and one addition (adds the identity when the window digit is 0 — never
         * skipped).
         *
         * `n` must be `< 2^bits`. Assumes complete addition (adding the identity costs the same as any
         * add), which holds for the Weierstrass/Edwards point types used here. The table is left in
         * projective form (no normalizeZ): normalizing this small a table costs more than the
         * mixed-add savings it would buy for a single multiply.
         * @returns real point `p`; `f` duplicates it only to match {@link wnafCachedCT}'s return shape
         * (this path needs no fake accumulator — its op-count is already scalar-independent).
         */
        fixedWindowCT(point, n, bits) {
          const W = FW_WINDOW;
          const size = 1 << W;
          const mask = bitMask(W);
          const table = new Array(size);
          table[0] = this.ZERO;
          for (let i = 1; i < size; i++)
            table[i] = table[i - 1].add(point);
          const windows = Math.ceil(bits / W);
          let acc = this.ZERO;
          for (let window = windows - 1; window >= 0; window--) {
            if (window !== windows - 1)
              for (let d = 0; d < W; d++)
                acc = acc.double();
            const digit = Number(n >> BigInt(window * W) & mask);
            let sel = table[0];
            for (let i = 1; i < size; i++)
              sel = i === digit ? table[i] : sel;
            acc = acc.add(sel);
          }
          return { p: acc, f: acc };
        }
        shouldBlind(point, cofactor) {
          if (this.randomBytes === void 0)
            return false;
          if (cofactor === _1n3)
            return true;
          if (point !== this.BASE)
            return false;
          if (this.baseCanBeBlinded === void 0)
            this.baseCanBeBlinded = this.mulUnsafe(this.BASE, this.Point.Fn.ORDER).is0();
          return this.baseCanBeBlinded;
        }
        mulSecret(point, scalar, cofactor, transform) {
          return this.shouldBlind(point, cofactor) ? this.mulCTBlinded(point, scalar, transform) : this.mulCT(point, scalar, transform);
        }
        mulUnsafe(point, scalar, transform) {
          this.assertPoint(point);
          if (!isPosBig(scalar))
            throw new Error("invalid scalar");
          const W = getWindowSize(point);
          if (W === 1 || scalar >= this.Point.Fn.ORDER)
            return mulAddUnsafe(this.Point, [point], [scalar], true);
          const precomputes = this.getWnafPrecomputes(W, point, this.bits, transform);
          return this.wnafCachedCT(precomputes, scalar).p;
        }
        // Remembers the window size used for precomputed wNAF multiplication of the given point
        // and drops any previously built tables. Usually only the base point is precomputed.
        // W=1 resets the point to the un-precomputed (table-less) paths.
        // W is additionally capped so tables stay under ~2 GiB ({@link TABLE_BYTES_MAX}).
        setWindowSize(point, W) {
          this.assertPoint(point);
          validateW(W, this.bits);
          const windows = Math.ceil((this.bits + BLIND_BITS) / W) + 1;
          validateTableBytes(windows * 2 ** (W - 1), this.Point.Fp.BYTES);
          pointWindowSizes.set(point, W);
          this.wnafPrecomputes.delete(point);
        }
        // True when a window size is set: tables themselves are built lazily on first multiply.
        hasWindowSize(point) {
          return getWindowSize(point) !== 1;
        }
      };
    }
  });

  // node_modules/@noble/curves/abstract/fft.js
  function checkU32(n, title = "n") {
    if (typeof n !== "number")
      throw new TypeError(`wrong u32 integer "${title}": expected number, got type=${typeof n}`);
    if (!Number.isSafeInteger(n) || n < 0 || n > 4294967295)
      throw new RangeError(`wrong u32 integer "${title}": expected 0..4294967295, got ${n}`);
    return n;
  }
  function isPowerOfTwo(x) {
    checkU32(x, "x");
    return (x & x - 1) === 0 && x !== 0;
  }
  function nextPowerOfTwo(n) {
    checkU32(n);
    if (n <= 1)
      return 1;
    if (n > 2147483648)
      throw new Error("nextPowerOfTwo overflow: result does not fit u32");
    return 1 << log2(n - 1) + 1 >>> 0;
  }
  function log2(n) {
    checkU32(n);
    return 31 - Math.clz32(n);
  }
  function poly(field, roots, create, fft, length) {
    validateField(field);
    const F = field;
    const _create = create || ((len, elm) => new Array(len).fill(elm ?? F.ZERO));
    const isPoly = (x) => {
      if (Array.isArray(x))
        return true;
      if (!ArrayBuffer.isView(x))
        return false;
      const v = x;
      return typeof v.length === "number" && typeof v.slice === "function" && typeof v[Symbol.iterator] === "function";
    };
    const checkPoly = (title, value) => {
      if (!isPoly(value))
        throw new TypeError(`"${title}" expected polynomial, got type=${typeof value}`);
    };
    const checkLength = (a, b) => {
      checkPoly("a", a);
      const L = a.length;
      if (b !== void 0) {
        checkPoly("b", b);
        if (b.length !== L)
          throw new Error(`poly: mismatched lengths ${L} vs ${b.length}`);
      }
      if (length !== void 0 && L !== length)
        throw new Error(`poly: expected fixed length ${length}, got ${L}`);
      return L;
    };
    function findOmegaIndex(x, n, brp = false, weights) {
      if (!isPowerOfTwo(n))
        throw new Error("poly.lagrange: expected power of two length, got " + n);
      const omega = weights || (brp ? roots.brp(log2(n)) : roots.roots(log2(n)));
      for (let i = 0; i < n; i++)
        if (F.eql(x, omega[i]))
          return i;
      return -1;
    }
    return {
      roots,
      create: _create,
      length,
      extend: (a, len) => {
        checkLength(a);
        const out = _create(len, F.ZERO);
        for (let i = 0; i < Math.min(a.length, len); i++)
          out[i] = a[i];
        return out;
      },
      degree: (a) => {
        checkLength(a);
        for (let i = a.length - 1; i >= 0; i--)
          if (!F.is0(a[i]))
            return i;
        return -1;
      },
      add: (a, b) => {
        const len = checkLength(a, b);
        const out = _create(len);
        for (let i = 0; i < len; i++)
          out[i] = F.add(a[i], b[i]);
        return out;
      },
      sub: (a, b) => {
        const len = checkLength(a, b);
        const out = _create(len);
        for (let i = 0; i < len; i++)
          out[i] = F.sub(a[i], b[i]);
        return out;
      },
      dot: (a, b) => {
        const len = checkLength(a, b);
        const out = _create(len);
        for (let i = 0; i < len; i++)
          out[i] = F.mul(a[i], b[i]);
        return out;
      },
      mul: (a, b) => {
        if (isPoly(b)) {
          const len = checkLength(a, b);
          if (fft) {
            const A = fft.direct(a, false, true);
            const B2 = fft.direct(b, false, true);
            for (let i = 0; i < A.length; i++)
              A[i] = F.mul(A[i], B2[i]);
            return fft.inverse(A, true, false);
          } else {
            const res = _create(len);
            for (let i = 0; i < len; i++) {
              for (let j = 0; j < len; j++) {
                const k = (i + j) % len;
                res[k] = F.add(res[k], F.mul(a[i], b[j]));
              }
            }
            return res;
          }
        } else {
          const out = _create(checkLength(a));
          for (let i = 0; i < out.length; i++)
            out[i] = F.mul(a[i], b);
          return out;
        }
      },
      convolve(a, b) {
        checkPoly("a", a);
        checkPoly("b", b);
        const len = nextPowerOfTwo(a.length + b.length - 1);
        return this.mul(this.extend(a, len), this.extend(b, len));
      },
      shift(p, factor) {
        checkPoly("p", p);
        const out = _create(p.length);
        if (length !== void 0 && p.length !== length)
          throw new Error(`poly: expected fixed length ${length}, got ${p.length}`);
        if (!p.length)
          return out;
        out[0] = p[0];
        for (let i = 1, power = F.ONE; i < p.length; i++) {
          power = F.mul(power, factor);
          out[i] = F.mul(p[i], power);
        }
        return out;
      },
      clone: (a) => {
        checkLength(a);
        const out = _create(a.length);
        for (let i = 0; i < a.length; i++)
          out[i] = a[i];
        return out;
      },
      eval: (a, basis) => {
        checkLength(a, basis);
        let acc = F.ZERO;
        for (let i = 0; i < a.length; i++)
          acc = F.add(acc, F.mul(a[i], basis[i]));
        return acc;
      },
      monomial: {
        basis: (x, n) => {
          const out = _create(n);
          let pow2 = F.ONE;
          for (let i = 0; i < n; i++) {
            out[i] = pow2;
            pow2 = F.mul(pow2, x);
          }
          return out;
        },
        eval: (a, x) => {
          checkLength(a);
          let acc = F.ZERO;
          for (let i = a.length - 1; i >= 0; i--)
            acc = F.add(F.mul(acc, x), a[i]);
          return acc;
        }
      },
      lagrange: {
        basis: (x, n, brp = false, weights) => {
          if (!isPowerOfTwo(n))
            throw new Error("poly.lagrange: expected power of two length, got " + n);
          const bits = log2(n);
          const cache = weights || (brp ? roots.brp(bits) : roots.roots(bits));
          const out = _create(n);
          const idx = findOmegaIndex(x, n, brp, weights);
          if (idx !== -1) {
            out[idx] = F.ONE;
            return out;
          }
          const tm = F.pow(x, BigInt(n));
          const c = F.mul(F.sub(tm, F.ONE), F.inv(BigInt(n)));
          const denom = _create(n);
          for (let i = 0; i < n; i++)
            denom[i] = F.sub(x, cache[i]);
          const inv = F.invertBatch(denom);
          for (let i = 0; i < n; i++)
            out[i] = F.mul(c, F.mul(cache[i], inv[i]));
          return out;
        },
        eval(a, x, brp = false) {
          checkLength(a);
          const idx = findOmegaIndex(x, a.length, brp);
          if (idx !== -1)
            return a[idx];
          const L = this.basis(x, a.length, brp);
          let acc = F.ZERO;
          for (let i = 0; i < a.length; i++)
            if (!F.is0(a[i]))
              acc = F.add(acc, F.mul(a[i], L[i]));
          return acc;
        }
      },
      vanishing(roots2) {
        checkPoly("roots", roots2);
        if (length !== void 0 && roots2.length !== length)
          throw new Error(`poly: expected fixed length ${length}, got ${roots2.length}`);
        const out = _create(roots2.length + 1, F.ZERO);
        out[0] = F.ONE;
        for (const r of roots2) {
          const neg = F.neg(r);
          for (let j = out.length - 1; j > 0; j--)
            out[j] = F.add(F.mul(out[j], neg), out[j - 1]);
          out[0] = F.mul(out[0], neg);
        }
        return out;
      }
    };
  }
  var init_fft = __esm({
    "node_modules/@noble/curves/abstract/fft.js"() {
      init_modular();
    }
  });

  // node_modules/@noble/curves/abstract/hash-to-curve.js
  function i2osp(value, length) {
    asafenumber(value);
    asafenumber(length);
    if (length < 0 || length > 4)
      throw new Error("invalid I2OSP length: " + length);
    if (value < 0 || value > 2 ** (8 * length) - 1)
      throw new Error("invalid I2OSP input: " + value);
    const res = Array.from({ length }).fill(0);
    for (let i = length - 1; i >= 0; i--) {
      res[i] = value & 255;
      value >>>= 8;
    }
    return new Uint8Array(res);
  }
  function strxor(a, b) {
    const arr = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) {
      arr[i] = a[i] ^ b[i];
    }
    return arr;
  }
  function normDST(DST) {
    if (!isBytes2(DST) && typeof DST !== "string")
      throw new Error("DST must be Uint8Array or ascii string");
    const dst = typeof DST === "string" ? asciiToBytes(DST) : DST;
    if (dst.length === 0)
      throw new Error("DST must be non-empty");
    return dst;
  }
  function expand_message_xmd(msg, DST, lenInBytes, H) {
    abytes2(msg);
    asafenumber(lenInBytes);
    if (typeof H !== "function")
      throw new Error("expand_message_xmd: expected hash function");
    asafenumber(H.outputLen, "hash.outputLen");
    asafenumber(H.blockLen, "hash.blockLen");
    DST = normDST(DST);
    if (DST.length > 255)
      DST = H(concatBytes2(asciiToBytes("H2C-OVERSIZE-DST-"), DST));
    const { outputLen: b_in_bytes, blockLen: r_in_bytes } = H;
    const ell = Math.ceil(lenInBytes / b_in_bytes);
    if (lenInBytes > 65535 || ell > 255)
      throw new Error("expand_message_xmd: invalid lenInBytes");
    const DST_prime = concatBytes2(DST, i2osp(DST.length, 1));
    const Z_pad = new Uint8Array(r_in_bytes);
    const l_i_b_str = i2osp(lenInBytes, 2);
    const b = new Array(ell);
    const b_0 = H(concatBytes2(Z_pad, msg, l_i_b_str, i2osp(0, 1), DST_prime));
    b[0] = H(concatBytes2(b_0, i2osp(1, 1), DST_prime));
    for (let i = 1; i < ell; i++) {
      const args = [strxor(b_0, b[i - 1]), i2osp(i + 1, 1), DST_prime];
      b[i] = H(concatBytes2(...args));
    }
    const pseudo_random_bytes = concatBytes2(...b);
    return pseudo_random_bytes.slice(0, lenInBytes);
  }
  function expand_message_xof(msg, DST, lenInBytes, k, H) {
    abytes2(msg);
    asafenumber(lenInBytes);
    asafenumber(k, "k");
    if (k < 0)
      throw new Error("expand_message_xof: invalid k");
    if (typeof H !== "function")
      throw new Error("expand_message_xof: expected XOF function");
    if (typeof H.create !== "function")
      throw new Error("expand_message_xof: expected XOF create");
    DST = normDST(DST);
    if (lenInBytes < 0 || lenInBytes > 65535)
      throw new Error("expand_message_xof: invalid lenInBytes");
    if (DST.length > 255) {
      const dkLen = Math.ceil(2 * k / 8);
      DST = H.create({ dkLen }).update(asciiToBytes("H2C-OVERSIZE-DST-")).update(DST).digest();
    }
    if (DST.length > 255)
      throw new Error("expand_message_xof: invalid DST");
    return H.create({ dkLen: lenInBytes }).update(msg).update(i2osp(lenInBytes, 2)).update(DST).update(i2osp(DST.length, 1)).digest();
  }
  function hash_to_field(msg, count, options) {
    validateObject(options, {
      p: "bigint",
      m: "number",
      k: "number",
      hash: "function"
    });
    const { p, k, m, hash, expand, DST } = options;
    asafenumber(hash.outputLen, "valid hash");
    abytes2(msg);
    asafenumber(count);
    asafenumber(m, "m");
    asafenumber(k, "k");
    if (p <= BigInt(1))
      throw new Error("hash_to_field: expected valid field characteristic");
    if (count < 1)
      throw new Error("hash_to_field: expected count >= 1");
    if (m < 1)
      throw new Error("hash_to_field: expected m >= 1");
    if (k < 0)
      throw new Error("hash_to_field: invalid k");
    const log2p = p.toString(2).length;
    const L = Math.ceil((log2p + k) / 8);
    const len_in_bytes = count * m * L;
    let prb;
    if (expand === "xmd") {
      prb = expand_message_xmd(msg, DST, len_in_bytes, hash);
    } else if (expand === "xof") {
      prb = expand_message_xof(msg, DST, len_in_bytes, k, hash);
    } else if (expand === "_internal_pass") {
      prb = msg;
    } else {
      throw new Error('expand must be "xmd" or "xof"');
    }
    const u = new Array(count);
    for (let i = 0; i < count; i++) {
      const e = new Array(m);
      for (let j = 0; j < m; j++) {
        const elm_offset = L * (j + i * m);
        const tv = prb.subarray(elm_offset, elm_offset + L);
        e[j] = mod(os2ip(tv), p);
      }
      u[i] = e;
    }
    return u;
  }
  function createHasher2(Point, mapToCurve, defaults) {
    if (typeof mapToCurve !== "function")
      throw new Error("mapToCurve() must be defined");
    validateObject(defaults);
    const snapshot = (src) => Object.freeze({
      ...src,
      DST: isBytes2(src.DST) ? copyBytes(src.DST) : src.DST,
      ...src.encodeDST === void 0 ? {} : { encodeDST: isBytes2(src.encodeDST) ? copyBytes(src.encodeDST) : src.encodeDST }
    });
    const safeDefaults = snapshot(defaults);
    const dstOverride = (options) => options && options.DST !== void 0 ? { DST: options.DST } : void 0;
    function map(num) {
      return Point.fromAffine(mapToCurve(num));
    }
    function clear(initial) {
      const P = initial.clearCofactor();
      if (P.equals(Point.ZERO))
        return Point.ZERO;
      P.assertValidity();
      return P;
    }
    return Object.freeze({
      get defaults() {
        return snapshot(safeDefaults);
      },
      Point,
      hashToCurve(msg, options) {
        const opts = Object.assign({}, safeDefaults, dstOverride(options));
        const u = hash_to_field(msg, 2, opts);
        const u0 = map(u[0]);
        const u1 = map(u[1]);
        return clear(u0.add(u1));
      },
      encodeToCurve(msg, options) {
        const optsDst = safeDefaults.encodeDST === void 0 ? {} : { DST: safeDefaults.encodeDST };
        const opts = Object.assign({}, safeDefaults, optsDst, dstOverride(options));
        const u = hash_to_field(msg, 1, opts);
        const u0 = map(u[0]);
        return clear(u0);
      },
      /** See {@link H2CHasher} */
      mapToCurve(scalars) {
        if (safeDefaults.m === 1) {
          if (typeof scalars !== "bigint")
            throw new Error("expected bigint (m=1)");
          return clear(map([scalars]));
        }
        if (!Array.isArray(scalars))
          throw new Error("expected array of bigints");
        if (scalars.length !== safeDefaults.m)
          throw new Error(`expected array of ${safeDefaults.m} bigints`);
        for (const i of scalars)
          if (typeof i !== "bigint")
            throw new Error("expected array of bigints");
        return clear(map(scalars));
      },
      // hash_to_scalar can produce 0: https://www.rfc-editor.org/errata/eid8393
      // RFC 9380, draft-irtf-cfrg-bbs-signatures-08. Default scalar DST is the shared generic
      // `HashToScalar-` prefix above unless the caller overrides it per invocation.
      hashToScalar(msg, options) {
        const N = Point.Fn.ORDER;
        const opts = Object.assign({}, safeDefaults, { DST: _DST_scalar }, dstOverride(options), {
          p: N,
          m: 1
        });
        return hash_to_field(msg, 1, opts)[0][0];
      }
    });
  }
  function SWUFpSqrtRatio(Fp, Z) {
    const F = validateField(Fp);
    const q = F.ORDER;
    let l = _0n4;
    for (let o = q - _1n4; o % _2n2 === _0n4; o /= _2n2)
      l += _1n4;
    const c1 = l;
    const _2n_pow_c1_1 = _2n2 << c1 - _1n4 - _1n4;
    const _2n_pow_c1 = _2n_pow_c1_1 * _2n2;
    const c2 = (q - _1n4) / _2n_pow_c1;
    const c3 = (c2 - _1n4) / _2n2;
    const c4 = _2n_pow_c1 - _1n4;
    const c5 = _2n_pow_c1_1;
    const c6 = F.pow(Z, c2);
    const c7 = F.pow(Z, (c2 + _1n4) / _2n2);
    let sqrtRatio = (u, v) => {
      let tv1 = c6;
      let tv2 = F.pow(v, c4);
      let tv3 = F.sqr(tv2);
      tv3 = F.mul(tv3, v);
      let tv5 = F.mul(u, tv3);
      tv5 = F.pow(tv5, c3);
      tv5 = F.mul(tv5, tv2);
      tv2 = F.mul(tv5, v);
      tv3 = F.mul(tv5, u);
      let tv4 = F.mul(tv3, tv2);
      tv5 = F.pow(tv4, c5);
      let isQR = F.eql(tv5, F.ONE);
      tv2 = F.mul(tv3, c7);
      tv5 = F.mul(tv4, tv1);
      tv3 = F.cmov(tv2, tv3, isQR);
      tv4 = F.cmov(tv5, tv4, isQR);
      for (let i = c1; i > _1n4; i--) {
        let tv52 = i - _2n2;
        tv52 = _2n2 << tv52 - _1n4;
        let tvv5 = F.pow(tv4, tv52);
        const e1 = F.eql(tvv5, F.ONE);
        tv2 = F.mul(tv3, tv1);
        tv1 = F.mul(tv1, tv1);
        tvv5 = F.mul(tv4, tv1);
        tv3 = F.cmov(tv2, tv3, e1);
        tv4 = F.cmov(tvv5, tv4, e1);
      }
      return { isValid: !F.is0(v) && (isQR || F.is0(u)), value: tv3 };
    };
    if (F.ORDER % _4n3 === _3n2) {
      const c12 = (F.ORDER - _3n2) / _4n3;
      const c22 = F.sqrt(F.neg(Z));
      sqrtRatio = (u, v) => {
        let tv1 = F.sqr(v);
        const tv2 = F.mul(u, v);
        tv1 = F.mul(tv1, tv2);
        let y1 = F.pow(tv1, c12);
        y1 = F.mul(y1, tv2);
        const y2 = F.mul(y1, c22);
        const tv3 = F.mul(F.sqr(y1), v);
        const isQR = F.eql(tv3, u);
        let y = F.cmov(y2, y1, isQR);
        return { isValid: !F.is0(v) && isQR, value: y };
      };
    }
    return sqrtRatio;
  }
  function mapToCurveSimpleSWU(Fp, opts) {
    const F = validateField(Fp);
    validateObject(opts, {}, {}, "opts");
    const { A, B: B2, Z } = opts;
    if (!F.isValidNot0(A) || !F.isValidNot0(B2) || !F.isValid(Z))
      throw new Error("mapToCurveSimpleSWU: invalid opts");
    if (F.eql(Z, F.neg(F.ONE)) || FpIsSquare(F, Z))
      throw new Error("mapToCurveSimpleSWU: invalid opts");
    const x = F.mul(B2, F.inv(F.mul(Z, A)));
    const gx = F.add(F.add(F.mul(F.sqr(x), x), F.mul(A, x)), B2);
    if (!FpIsSquare(F, gx))
      throw new Error("mapToCurveSimpleSWU: invalid opts");
    const sqrtRatio = SWUFpSqrtRatio(F, Z);
    if (!F.isOdd)
      throw new Error("Field does not have .isOdd()");
    return (u) => {
      let tv1, tv2, tv3, tv4, tv5, tv6, x2, y;
      tv1 = F.sqr(u);
      tv1 = F.mul(tv1, Z);
      tv2 = F.sqr(tv1);
      tv2 = F.add(tv2, tv1);
      tv3 = F.add(tv2, F.ONE);
      tv3 = F.mul(tv3, B2);
      tv4 = F.cmov(Z, F.neg(tv2), !F.eql(tv2, F.ZERO));
      tv4 = F.mul(tv4, A);
      tv2 = F.sqr(tv3);
      tv6 = F.sqr(tv4);
      tv5 = F.mul(tv6, A);
      tv2 = F.add(tv2, tv5);
      tv2 = F.mul(tv2, tv3);
      tv6 = F.mul(tv6, tv4);
      tv5 = F.mul(tv6, B2);
      tv2 = F.add(tv2, tv5);
      x2 = F.mul(tv1, tv3);
      const { isValid, value } = sqrtRatio(tv2, tv6);
      y = F.mul(tv1, u);
      y = F.mul(y, value);
      x2 = F.cmov(x2, tv3, isValid);
      y = F.cmov(y, value, isValid);
      const e1 = F.isOdd(u) === F.isOdd(y);
      y = F.cmov(F.neg(y), y, e1);
      const tv4_inv = FpInvertBatch(F, [tv4], true)[0];
      x2 = F.mul(x2, tv4_inv);
      return { x: x2, y };
    };
  }
  var _0n4, _1n4, _2n2, _3n2, _4n3, os2ip, _DST_scalar;
  var init_hash_to_curve = __esm({
    "node_modules/@noble/curves/abstract/hash-to-curve.js"() {
      init_utils2();
      init_modular();
      _0n4 = /* @__PURE__ */ BigInt(0);
      _1n4 = /* @__PURE__ */ BigInt(1);
      _2n2 = /* @__PURE__ */ BigInt(2);
      _3n2 = /* @__PURE__ */ BigInt(3);
      _4n3 = /* @__PURE__ */ BigInt(4);
      os2ip = bytesToNumberBE;
      _DST_scalar = "HashToScalar-";
    }
  });

  // node_modules/@noble/curves/abstract/frost.js
  function createFROST(opts) {
    validateObject(opts, {
      name: "string",
      hash: "function"
    }, {
      hashToScalar: "function",
      validatePoint: "function",
      parsePublicKey: "function",
      adjustScalar: "function",
      adjustPoint: "function",
      challenge: "function",
      adjustNonces: "function",
      adjustSecret: "function",
      adjustPublic: "function",
      adjustGroupCommitmentShare: "function",
      adjustTx: "object",
      adjustDKG: "function"
    });
    validatePointCons(opts.Point);
    const { Point, validatePoint, parsePublicKey, adjustScalar, adjustPoint: adjustPointHook, challenge, adjustNonces, adjustSecret, adjustPublic, adjustGroupCommitmentShare, adjustDKG } = opts;
    const Fn = opts.Fn === void 0 ? Point.Fn : opts.Fn;
    const adjustTx = opts.adjustTx === void 0 ? void 0 : { encode: opts.adjustTx.encode, decode: opts.adjustTx.decode };
    if (adjustTx)
      validateObject(adjustTx, { encode: "function", decode: "function" });
    const hashBytes = opts.hash;
    const hashToScalar = opts.hashToScalar === void 0 ? (msg, opts2 = { DST: new Uint8Array() }) => {
      const t = hashBytes(concatBytes2(opts2.DST, msg));
      return Fn.create(Fn.isLE ? bytesToNumberLE(t) : bytesToNumberBE(t));
    } : opts.hashToScalar;
    const H1Prefix = utf8ToBytes(opts.H1 !== void 0 ? opts.H1 : opts.name + "rho");
    const H2Prefix = utf8ToBytes(opts.H2 !== void 0 ? opts.H2 : opts.name + "chal");
    const H3Prefix = utf8ToBytes(opts.H3 !== void 0 ? opts.H3 : opts.name + "nonce");
    const H4Prefix = utf8ToBytes(opts.H4 !== void 0 ? opts.H4 : opts.name + "msg");
    const H5Prefix = utf8ToBytes(opts.H5 !== void 0 ? opts.H5 : opts.name + "com");
    const HDKGPrefix = utf8ToBytes(opts.HDKG !== void 0 ? opts.HDKG : opts.name + "dkg");
    const HIDPrefix = utf8ToBytes(opts.HID !== void 0 ? opts.HID : opts.name + "id");
    const H1 = (msg) => hashToScalar(msg, { DST: H1Prefix });
    const H2 = (msg) => hashToScalar(msg, { DST: H2Prefix });
    const H3 = (msg) => hashToScalar(msg, { DST: H3Prefix });
    const H4 = (msg) => hashBytes(concatBytes2(H4Prefix, msg));
    const H5 = (msg) => hashBytes(concatBytes2(H5Prefix, msg));
    const HDKG = (msg) => hashToScalar(msg, { DST: HDKGPrefix });
    const HID = (msg) => hashToScalar(msg, { DST: HIDPrefix });
    const randomScalar = (rng = randomBytes2) => {
      if (typeof rng !== "function")
        throw new TypeError('"rng" expected function, got type=' + typeof rng);
      const t = mapHashToField(rng(getMinHashLength(Fn.ORDER)), Fn.ORDER, Fn.isLE);
      return Fn.isLE ? bytesToNumberLE(t) : bytesToNumberBE(t);
    };
    const serializePoint = (p) => p.toBytes();
    const validatePublicPoint = (p) => {
      p.assertValidity();
      if (p.is0())
        throw new Error("invalid point: identity");
      if (!p.isTorsionFree())
        throw new Error("bad point: not in prime-order subgroup");
      if (validatePoint)
        validatePoint(p);
      return p;
    };
    const parsePoint = (bytes) => validatePublicPoint(Point.fromBytes(bytes));
    const nonceCommitments = (identifier, nonces) => ({
      identifier,
      hiding: serializePoint(Point.BASE.multiply(Fn.fromBytes(nonces.hiding))),
      binding: serializePoint(Point.BASE.multiply(Fn.fromBytes(nonces.binding)))
    });
    const adjustPoint = adjustPointHook === void 0 ? (n) => n : adjustPointHook;
    const validateIdentifier = (n) => {
      if (!Fn.isValid(n) || Fn.is0(n))
        throw new Error("Invalid identifier " + n);
      return n;
    };
    const serializeIdentifier = (id) => bytesToHex2(Fn.toBytes(validateIdentifier(id)));
    const parseIdentifier = (id, title = "identifier") => {
      astring(id, title);
      const n = validateIdentifier(Fn.fromBytes(hexToBytes2(id)));
      if (serializeIdentifier(n) !== id)
        throw new Error("expected canonical identifier hex");
      return n;
    };
    const copyRound1Package = (p) => ({
      identifier: serializeIdentifier(parseIdentifier(p.identifier)),
      commitment: p.commitment.map((c) => copyBytes(c)),
      proofOfKnowledge: copyBytes(p.proofOfKnowledge)
    });
    const canonicalRound1Packages = (packages) => {
      const snapshot = packages.map(copyRound1Package);
      snapshot.sort((a, b) => {
        const ai = parseIdentifier(a.identifier);
        const bi = parseIdentifier(b.identifier);
        return ai < bi ? -1 : ai > bi ? 1 : 0;
      });
      return snapshot;
    };
    const equalRound1Transcripts = (a, b) => {
      if (a.length !== b.length)
        return false;
      for (let i = 0; i < a.length; i++) {
        const p = a[i];
        const q = b[i];
        if (p.identifier !== q.identifier || p.commitment.length !== q.commitment.length)
          return false;
        for (let j = 0; j < p.commitment.length; j++) {
          if (!equalBytes(p.commitment[j], q.commitment[j]))
            return false;
        }
        if (!equalBytes(p.proofOfKnowledge, q.proofOfKnowledge))
          return false;
      }
      return true;
    };
    const Signature = {
      // RFC 9591 Appendix A encodes signatures canonically as
      // SerializeElement(R) || SerializeScalar(z).
      encode: (R, z) => {
        let res = concatBytes2(serializePoint(R), Fn.toBytes(z));
        if (adjustTx)
          res = adjustTx.encode(res);
        return res;
      },
      decode: (sig) => {
        if (adjustTx)
          sig = adjustTx.decode(sig);
        const Rbytes = sig.subarray(0, -Fn.BYTES);
        const R = parsePoint(Rbytes);
        if (serializePoint(R).length !== Rbytes.length)
          throw new Error("invalid signature encoding");
        const z = Fn.fromBytes(sig.subarray(-Fn.BYTES));
        return { R, z };
      }
    };
    const genPointScalarPair = (rng = randomBytes2) => {
      let n = randomScalar(rng);
      if (adjustScalar)
        n = adjustScalar(n);
      let p = Point.BASE.multiply(n);
      return { scalar: n, point: p };
    };
    const nrErr = "roots are unavailable in FROST polynomial mode";
    const noRoots = {
      info: { G: Fn.ZERO, oddFactor: Fn.ZERO, powerOfTwo: 0 },
      roots() {
        throw new Error(nrErr);
      },
      brp() {
        throw new Error(nrErr);
      },
      inverse() {
        throw new Error(nrErr);
      },
      omega() {
        throw new Error(nrErr);
      },
      clear() {
      }
    };
    const Poly = poly(Fn, noRoots);
    const msm = (points, scalars) => mulAddUnsafe(Point, points, scalars);
    const polynomialEvaluate = (x, coeffs) => {
      if (!coeffs.length)
        throw new Error("empty coefficients");
      return Poly.monomial.eval(coeffs, x);
    };
    const deriveInterpolatingValue = (L, xi) => {
      const err = "invalid parameters";
      if (!L.some((x) => Fn.eql(x, xi)))
        throw new Error(err);
      const Lset = new Set(L);
      if (Lset.size !== L.length)
        throw new Error(err);
      if (!Lset.has(xi))
        throw new Error(err);
      let num = Fn.ONE;
      let den = Fn.ONE;
      for (const x of L) {
        if (Fn.eql(x, xi))
          continue;
        num = Fn.mul(num, x);
        den = Fn.mul(den, Fn.sub(x, xi));
      }
      return Fn.div(num, den);
    };
    const evalutateVSS = (identifier, commitment) => {
      const monomial = Poly.monomial.basis(identifier, commitment.length);
      return msm(commitment, monomial);
    };
    const generateSecretPolynomial = (signers, secret, coeffs, rng = randomBytes2) => {
      validateSigners(signers);
      if (secret !== void 0)
        abytes2(secret, Fn.BYTES, "secret");
      if (coeffs !== void 0)
        aarray(coeffs, "coeffs");
      if (typeof rng !== "function")
        throw new TypeError('"rng" expected function, got type=' + typeof rng);
      const secretScalar = secret === void 0 ? randomScalar(rng) : Fn.fromBytes(secret);
      if (!coeffs) {
        coeffs = [];
        for (let i = 0; i < signers.min - 1; i++)
          coeffs.push(randomScalar(rng));
      }
      if (coeffs.length !== signers.min - 1)
        throw new Error("wrong coefficients length");
      const coefficients = [secretScalar, ...coeffs];
      const commitment = coefficients.map((i) => Point.BASE.multiply(i));
      return { coefficients, commitment, secret: secretScalar };
    };
    const ProofOfKnowledge = {
      challenge: (id, verKey, R) => HDKG(concatBytes2(Fn.toBytes(id), serializePoint(verKey), serializePoint(R))),
      compute(id, coefficents, commitments, rng = randomBytes2) {
        if (coefficents.length < 1)
          throw new Error("coefficients should have at least one element");
        const { point: R, scalar: k } = genPointScalarPair(rng);
        const verKey = commitments[0];
        const c = this.challenge(id, verKey, R);
        const mu = Fn.add(k, Fn.mul(coefficents[0], c));
        return Signature.encode(R, mu);
      },
      validate(id, commitment, proof) {
        if (commitment.length < 1)
          throw new Error("commitment should have at least one element");
        const { R, z } = Signature.decode(proof);
        const phi = parsePoint(commitment[0]);
        const c = this.challenge(id, phi, R);
        if (!R.equals(Point.BASE.multiplyUnsafe(z).subtract(phi.multiplyUnsafe(c))))
          throw new Error("invalid proof of knowledge");
      }
    };
    const Basic = {
      challenge: (R, PK, msg) => {
        if (challenge)
          return challenge(R, PK, msg);
        return H2(concatBytes2(serializePoint(R), serializePoint(PK), msg));
      },
      sign(msg, sk, rng = randomBytes2) {
        const { point: R, scalar: r } = genPointScalarPair(rng);
        const PK = Point.BASE.multiply(sk);
        const c = this.challenge(R, PK, msg);
        const z = Fn.add(r, Fn.mul(c, sk));
        return [R, z];
      },
      verify(msg, R, z, PK) {
        if (adjustPointHook)
          PK = adjustPointHook(PK);
        if (adjustPointHook)
          R = adjustPointHook(R);
        const c = this.challenge(R, PK, msg);
        const zB = Point.BASE.multiplyUnsafe(z);
        const cA = PK.multiplyUnsafe(c);
        let check = zB.subtract(cA).subtract(R);
        if (check.clearCofactor)
          check = check.clearCofactor();
        return Point.ZERO.equals(check);
      }
    };
    const validateSecretShare = (identifier, commitment, signingShare) => {
      if (!Point.BASE.multiply(signingShare).equals(evalutateVSS(identifier, commitment)))
        throw new Error("invalid secret share");
    };
    const Identifier = {
      fromNumber(n) {
        if (!Number.isSafeInteger(n))
          throw new Error("expected safe interger");
        return serializeIdentifier(BigInt(n));
      },
      // Not in spec, but in FROST implementation,
      // seems useful and nice, no need to sync identifiers (would require more interactions)
      derive(s) {
        astring(s, "s");
        return serializeIdentifier(HID(utf8ToBytes(s)));
      }
    };
    const generateNonce = (secret, rng = randomBytes2) => H3(concatBytes2(rng(32), Fn.toBytes(secret)));
    const getGroupCommitment = (GPK, commitmentList, msg) => {
      const CL = commitmentList.map((i) => [
        i.identifier,
        parseIdentifier(i.identifier),
        parsePoint(i.hiding),
        parsePoint(i.binding)
      ]);
      CL.sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
      const Cbytes = [];
      for (const [_, id, hC, bC] of CL)
        Cbytes.push(Fn.toBytes(id), serializePoint(hC), serializePoint(bC));
      const encodedCommitmentHash = H5(concatBytes2(...Cbytes));
      const rhoPrefix = concatBytes2(serializePoint(GPK), H4(msg), encodedCommitmentHash);
      const bindingFactors = {};
      for (const [i, id] of CL) {
        bindingFactors[i] = H1(concatBytes2(rhoPrefix, Fn.toBytes(id)));
      }
      let hidingSum = Point.ZERO;
      const points = [];
      const scalars = [];
      for (const [i, _, hC, bC] of CL) {
        if (Point.ZERO.equals(hC) || Point.ZERO.equals(bC))
          throw new Error("infinity commitment");
        hidingSum = hidingSum.add(hC);
        points.push(bC);
        scalars.push(bindingFactors[i]);
      }
      const groupCommitment = hidingSum.add(msm(points, scalars));
      const identifiers = CL.map((i) => i[1]);
      return { identifiers, groupCommitment, bindingFactors };
    };
    const prepareShare = (PK, commitmentList, msg, identifier) => {
      const GPK = adjustPoint(parsePoint(PK));
      const id = parseIdentifier(identifier);
      const { identifiers, groupCommitment, bindingFactors } = getGroupCommitment(GPK, commitmentList, msg);
      const bindingFactor = bindingFactors[identifier];
      const lambda = deriveInterpolatingValue(identifiers, id);
      const challenge2 = Basic.challenge(groupCommitment, GPK, msg);
      return { lambda, challenge: challenge2, bindingFactor, groupCommitment };
    };
    Object.freeze(Identifier);
    const frost = {
      Identifier,
      // DKG is Distributed Key Generation, not Trusted Dealer Key Generation.
      DKG: Object.freeze({
        // NOTE: we allow to pass secret scalar from user side,
        // this way it can be derived, instead of random generation
        round1: (id, signers, secret, rng = randomBytes2) => {
          const idNum = parseIdentifier(id, "id");
          validateSigners(signers);
          const { coefficients, commitment } = generateSecretPolynomial(signers, secret, void 0, rng);
          const proofOfKnowledge = ProofOfKnowledge.compute(idNum, coefficients, commitment, rng);
          const commitmentBytes = commitment.map(serializePoint);
          const round1Public = {
            identifier: serializeIdentifier(idNum),
            commitment: commitmentBytes,
            proofOfKnowledge
          };
          const round1Secret = {
            identifier: idNum,
            coefficients,
            commitment: commitment.map(serializePoint),
            // Copy threshold metadata instead of retaining the caller-owned object by reference.
            signers: { min: signers.min, max: signers.max },
            step: 1
          };
          return { public: round1Public, secret: round1Secret };
        },
        round2: (secret, others) => {
          validateObject(secret, { identifier: "bigint", commitment: "object", signers: "object" }, { coefficients: "object", round1Cache: "object", round2Cache: "object", step: "number" }, "secret");
          validateSigners(secret.signers, "secret.signers");
          aarray(others, "others");
          if (others.length !== secret.signers.max - 1)
            throw new Error("wrong number of round1 packages");
          if (!secret.coefficients || secret.step === 3)
            throw new Error("round3 package used in round2");
          const authenticatedRound1 = canonicalRound1Packages(others);
          if (secret.round2Cache !== void 0) {
            if (secret.round1Cache === void 0 || !equalRound1Transcripts(secret.round1Cache, authenticatedRound1))
              throw new Error("round1 packages do not match authenticated transcript");
            return secret.round2Cache;
          }
          const res = {};
          for (const p of authenticatedRound1) {
            if (p.commitment.length !== secret.signers.min)
              throw new Error("wrong number of commitments");
            const id = parseIdentifier(p.identifier);
            if (id === secret.identifier)
              throw new Error("duplicate id=" + serializeIdentifier(id));
            ProofOfKnowledge.validate(id, p.commitment, p.proofOfKnowledge);
            for (const c of p.commitment)
              parsePoint(c);
            if (res[p.identifier])
              throw new Error("Duplicate id=" + id);
            const signingShare = Fn.toBytes(polynomialEvaluate(id, secret.coefficients));
            res[p.identifier] = {
              identifier: serializeIdentifier(secret.identifier),
              signingShare
            };
          }
          secret.round1Cache = authenticatedRound1;
          secret.round2Cache = res;
          secret.step = 2;
          return res;
        },
        round3: (secret, round1, round2) => {
          validateObject(secret, { identifier: "bigint", commitment: "object", signers: "object" }, { coefficients: "object", round1Cache: "object", round2Cache: "object", step: "number" }, "secret");
          validateSigners(secret.signers, "secret.signers");
          aarray(round1, "round1");
          aarray(round2, "round2");
          if (round1.length !== secret.signers.max - 1)
            throw new Error("wrong length of round1 packages");
          if (!secret.coefficients || secret.step !== 2 || !secret.round1Cache)
            throw new Error("round2 package used in round3");
          const suppliedRound1 = canonicalRound1Packages(round1);
          const authenticatedRound1 = secret.round1Cache;
          if (!equalRound1Transcripts(authenticatedRound1, suppliedRound1))
            throw new Error("round1 packages do not match authenticated transcript");
          if (round2.length !== authenticatedRound1.length)
            throw new Error("wrong length of round2 packages");
          const merged = {};
          for (const r1 of authenticatedRound1) {
            if (!r1.identifier || !r1.commitment)
              throw new Error("wrong round1 share");
            merged[r1.identifier] = { ...r1 };
          }
          for (const r2 of round2) {
            if (!r2.identifier || !r2.signingShare)
              throw new Error("wrong round2 share");
            if (!merged[r2.identifier])
              throw new Error("round1 share for " + r2.identifier + " is missing");
            merged[r2.identifier].signingShare = r2.signingShare;
          }
          if (Object.keys(merged).length !== authenticatedRound1.length)
            throw new Error("mismatch identifiers between rounds");
          let signingShare = Fn.ZERO;
          if (secret.commitment.length !== secret.signers.min)
            throw new Error("wrong commitments length");
          const localCommitment = secret.commitment.map(parsePoint);
          const localShare = polynomialEvaluate(secret.identifier, secret.coefficients);
          validateSecretShare(secret.identifier, localCommitment, localShare);
          const localCommitmentBytes = localCommitment.map(serializePoint);
          const commitments = {
            [serializeIdentifier(secret.identifier)]: localCommitmentBytes
          };
          for (const k in merged) {
            const v = merged[k];
            if (!v.signingShare || !v.commitment)
              throw new Error("mismatch identifiers");
            const id = parseIdentifier(k);
            const signingSharePart = Fn.fromBytes(v.signingShare);
            const commitment = v.commitment.map(parsePoint);
            validateSecretShare(secret.identifier, commitment, signingSharePart);
            signingShare = Fn.add(signingShare, signingSharePart);
            const idSer = serializeIdentifier(id);
            if (commitments[idSer])
              throw new Error("duplicated id=" + idSer);
            commitments[idSer] = v.commitment;
          }
          signingShare = Fn.add(signingShare, localShare);
          const mergedCommitment = new Array(secret.signers.min).fill(Point.ZERO);
          for (const k in commitments) {
            const v = commitments[k];
            if (v.length !== secret.signers.min)
              throw new Error("wrong commitments length");
            for (let i = 0; i < v.length; i++)
              mergedCommitment[i] = mergedCommitment[i].add(parsePoint(v[i]));
          }
          const mergedCommitmentBytes = mergedCommitment.map(serializePoint);
          const verifyingShares = {};
          for (const k in commitments)
            verifyingShares[k] = serializePoint(evalutateVSS(parseIdentifier(k), mergedCommitment));
          let res = {
            public: {
              signers: { min: secret.signers.min, max: secret.signers.max },
              commitments: mergedCommitmentBytes,
              verifyingShares: Object.fromEntries(Object.entries(verifyingShares).map(([k, v]) => [k, v.slice()]))
            },
            secret: {
              identifier: serializeIdentifier(secret.identifier),
              signingShare: Fn.toBytes(signingShare)
            }
          };
          if (adjustDKG)
            res = adjustDKG(res);
          for (let i = 0; i < secret.coefficients.length; i++)
            secret.coefficients[i] -= secret.coefficients[i];
          delete secret.coefficients;
          delete secret.round1Cache;
          delete secret.round2Cache;
          secret.step = 3;
          return res;
        },
        clean(secret) {
          validateObject(secret, { identifier: "bigint", commitment: "object", signers: "object" }, { coefficients: "object", round1Cache: "object", round2Cache: "object", step: "number" }, "secret");
          secret.identifier -= secret.identifier;
          if (secret.coefficients) {
            for (let i = 0; i < secret.coefficients.length; i++)
              secret.coefficients[i] -= secret.coefficients[i];
          }
          delete secret.round1Cache;
          delete secret.round2Cache;
          secret.step = 3;
        }
      }),
      // Trusted dealer setup
      // Generates keys for all participants
      trustedDealer(signers, identifiers, secret, rng = randomBytes2) {
        validateSigners(signers);
        if (identifiers === void 0) {
          identifiers = [];
          for (let i = 1; i <= signers.max; i++)
            identifiers.push(Identifier.fromNumber(i));
        } else {
          aarray(identifiers, "identifiers");
          if (identifiers.length !== signers.max)
            throw new Error("identifiers should be array of " + signers.max);
        }
        const identifierNums = {};
        for (const id of identifiers) {
          const idNum = parseIdentifier(id);
          if (id in identifierNums)
            throw new Error("duplicated id=" + id);
          identifierNums[id] = idNum;
        }
        const sp = generateSecretPolynomial(signers, secret, void 0, rng);
        const commitmentBytes = sp.commitment.map(serializePoint);
        const secretShares = {};
        const verifyingShares = {};
        for (const id of identifiers) {
          const signingShare = polynomialEvaluate(identifierNums[id], sp.coefficients);
          verifyingShares[id] = serializePoint(Point.BASE.multiply(signingShare));
          secretShares[id] = {
            identifier: id,
            signingShare: Fn.toBytes(signingShare)
          };
        }
        return {
          public: {
            signers: { min: signers.min, max: signers.max },
            commitments: commitmentBytes,
            verifyingShares
          },
          secretShares
        };
      },
      // Validate secret (from trusted dealer or DKG)
      validateSecret(secret, pub) {
        validateObject(secret, { identifier: "string", signingShare: "object" }, {}, "secret");
        abytes2(secret.signingShare, Fn.BYTES, "secret.signingShare");
        validateObject(pub, {
          signers: "object",
          commitments: "object",
          verifyingShares: "object"
        }, {}, "pub");
        validateSigners(pub.signers, "pub.signers");
        aarray(pub.commitments, "pub.commitments");
        const id = parseIdentifier(secret.identifier);
        const commitment = pub.commitments.map(parsePoint);
        const signingShare = Fn.fromBytes(secret.signingShare);
        validateSecretShare(id, commitment, signingShare);
      },
      // Actual signing
      // Round 1: each participant commit to nonces
      // Nonces kept private, commitments sent to coordinator (or every other participant)
      // NOTE: we don't need the message at this point, which lets a coordinator
      // keep multiple nonce commitments per participant in advance and skip
      // round1 for signing.
      // But then each participant needs to remember generated shares
      commit(secret, rng = randomBytes2) {
        validateObject(secret, { identifier: "string", signingShare: "object" }, {}, "secret");
        abytes2(secret.signingShare, Fn.BYTES, "secret.signingShare");
        if (typeof rng !== "function")
          throw new TypeError('"rng" expected function, got type=' + typeof rng);
        const secretScalar = Fn.fromBytes(secret.signingShare);
        const hiding = generateNonce(secretScalar, rng);
        const binding = generateNonce(secretScalar, rng);
        const nonces = { hiding: Fn.toBytes(hiding), binding: Fn.toBytes(binding) };
        return { nonces, commitments: nonceCommitments(secret.identifier, nonces) };
      },
      // Round2: sign. Each participant creates a signature share from the secret
      // and the selected nonce commitments.
      signShare(secret, pub, nonces, commitmentList, msg) {
        validateObject(secret, { identifier: "string", signingShare: "object" }, {}, "secret");
        abytes2(secret.signingShare, Fn.BYTES, "secret.signingShare");
        validateObject(pub, {
          signers: "object",
          commitments: "object",
          verifyingShares: "object"
        }, {}, "pub");
        validateSigners(pub.signers, "pub.signers");
        aarray(pub.commitments, "pub.commitments");
        validateObject(nonces, { hiding: "object", binding: "object" }, {}, "nonces");
        abytes2(nonces.hiding, Fn.BYTES, "nonces.hiding");
        abytes2(nonces.binding, Fn.BYTES, "nonces.binding");
        aarray(commitmentList, "commitmentList");
        abytes2(msg, void 0, "msg");
        validateCommitmentsNum(pub.signers, commitmentList.length);
        const hidingNonce0 = Fn.fromBytes(nonces.hiding);
        const bindingNonce0 = Fn.fromBytes(nonces.binding);
        if (Fn.is0(hidingNonce0) || Fn.is0(bindingNonce0))
          throw new Error("signing nonces already used");
        const expectedCommitment = {
          identifier: secret.identifier,
          hiding: serializePoint(Point.BASE.multiply(hidingNonce0)),
          binding: serializePoint(Point.BASE.multiply(bindingNonce0))
        };
        const commitment = commitmentList.find((i) => i.identifier === secret.identifier);
        if (!commitment)
          throw new Error("missing signer commitment");
        if (bytesToHex2(commitment.hiding) !== bytesToHex2(expectedCommitment.hiding) || bytesToHex2(commitment.binding) !== bytesToHex2(expectedCommitment.binding))
          throw new Error("incorrect signer commitment");
        if (adjustSecret)
          secret = adjustSecret(secret, pub);
        if (adjustPublic)
          pub = adjustPublic(pub);
        const SK = Fn.fromBytes(secret.signingShare);
        const { lambda, challenge: challenge2, bindingFactor, groupCommitment } = prepareShare(pub.commitments[0], commitmentList, msg, secret.identifier);
        const N = adjustNonces ? adjustNonces(groupCommitment, nonces) : nonces;
        const hidingNonce = adjustNonces ? Fn.fromBytes(N.hiding) : hidingNonce0;
        const bindingNonce = adjustNonces ? Fn.fromBytes(N.binding) : bindingNonce0;
        const t = Fn.mul(Fn.mul(lambda, SK), challenge2);
        const t2 = Fn.mul(bindingNonce, bindingFactor);
        const r = Fn.toBytes(Fn.add(Fn.add(hidingNonce, t2), t));
        nonces.hiding.fill(0);
        nonces.binding.fill(0);
        return r;
      },
      // Each participant (or coordinator) can verify signatures from other participants
      verifyShare(pub, commitmentList, msg, identifier, sigShare) {
        validateObject(pub, {
          signers: "object",
          commitments: "object",
          verifyingShares: "object"
        }, {}, "pub");
        validateSigners(pub.signers, "pub.signers");
        aarray(pub.commitments, "pub.commitments");
        aarray(commitmentList, "commitmentList");
        abytes2(msg, void 0, "msg");
        parseIdentifier(identifier);
        abytes2(sigShare, Fn.BYTES, "sigShare");
        if (adjustPublic)
          pub = adjustPublic(pub);
        const comm = commitmentList.find((i) => i.identifier === identifier);
        if (!comm)
          throw new Error("cannot find identifier commitment");
        const PK = parsePoint(pub.verifyingShares[identifier]);
        const hidingNonceCommitment = parsePoint(comm.hiding);
        const bindingNonceCommitment = parsePoint(comm.binding);
        const { lambda, challenge: challenge2, bindingFactor, groupCommitment } = prepareShare(pub.commitments[0], commitmentList, msg, identifier);
        let commShare = hidingNonceCommitment.add(bindingNonceCommitment.multiplyUnsafe(bindingFactor));
        if (adjustGroupCommitmentShare)
          commShare = adjustGroupCommitmentShare(groupCommitment, commShare);
        const l = Point.BASE.multiplyUnsafe(Fn.fromBytes(sigShare));
        const r = commShare.add(PK.multiplyUnsafe(Fn.mul(challenge2, lambda)));
        return l.equals(r);
      },
      // Aggregate multiple signature shares into groupSignature
      aggregate(pub, commitmentList, msg, sigShares) {
        validateObject(pub, {
          signers: "object",
          commitments: "object",
          verifyingShares: "object"
        }, {}, "pub");
        validateSigners(pub.signers, "pub.signers");
        aarray(pub.commitments, "pub.commitments");
        aarray(commitmentList, "commitmentList");
        abytes2(msg, void 0, "msg");
        validateObject(sigShares, {}, {}, "sigShares");
        const rawPub = pub;
        if (adjustPublic)
          pub = adjustPublic(pub);
        try {
          validateCommitmentsNum(pub.signers, commitmentList.length);
        } catch {
          throw new AggErr("aggregation failed", []);
        }
        const ids = commitmentList.map((i) => i.identifier);
        const seen = /* @__PURE__ */ new Set();
        for (const id of ids) {
          if (seen.has(id))
            throw new AggErr("aggregation failed", []);
          seen.add(id);
        }
        if (ids.length !== Object.keys(sigShares).length)
          throw new AggErr("aggregation failed", []);
        for (const id of ids) {
          if (!(id in sigShares) || !(id in pub.verifyingShares))
            throw new AggErr("aggregation failed", []);
        }
        const GPK = parsePoint(pub.commitments[0]);
        const { groupCommitment } = getGroupCommitment(GPK, commitmentList, msg);
        let z = Fn.ZERO;
        for (const id of ids)
          z = Fn.add(z, Fn.fromBytes(sigShares[id]));
        if (!Basic.verify(msg, groupCommitment, z, GPK)) {
          const cheaters = [];
          for (const id of ids) {
            if (!this.verifyShare(rawPub, commitmentList, msg, id, sigShares[id]))
              cheaters.push(id);
          }
          throw new AggErr("aggregation failed", cheaters);
        }
        return Signature.encode(groupCommitment, z);
      },
      // Basic sign/verify using single key
      sign(msg, secretKey) {
        let sk = Fn.fromBytes(secretKey);
        if (adjustScalar)
          sk = adjustScalar(sk);
        const [R, z] = Basic.sign(msg, sk);
        return Signature.encode(R, z);
      },
      verify(sig, msg, publicKey) {
        const PK = parsePublicKey ? validatePublicPoint(parsePublicKey(publicKey)) : parsePoint(publicKey);
        const { R, z } = Signature.decode(sig);
        return Basic.verify(msg, R, z, PK);
      },
      // Combine multiple secret shares to restore secret
      combineSecret(shares, signers) {
        aarray(shares, "shares");
        validateSigners(signers);
        if (shares.length < signers.min || shares.length > signers.max)
          throw new Error("wrong secret shares array");
        const points = [];
        const seen = {};
        for (const s of shares) {
          const idNum = parseIdentifier(s.identifier);
          const id = serializeIdentifier(idNum);
          if (seen[id])
            throw new Error("duplicated id=" + id);
          seen[id] = true;
          points.push([idNum, Fn.fromBytes(s.signingShare)]);
        }
        const xCoords = points.map(([x]) => x);
        let res = Fn.ZERO;
        for (const [x, y] of points)
          res = Fn.add(res, Fn.mul(y, deriveInterpolatingValue(xCoords, x)));
        return Fn.toBytes(res);
      },
      // Utils
      utils: Object.freeze({
        Fn,
        // NOTE: we re-export it here because it may be different from Point.Fn (ed448 is fun!)
        // Test RNG overrides still go through noble's non-zero scalar derivation; this is not a raw
        // "bytes become scalar" escape hatch.
        randomScalar: (rng = randomBytes2) => Fn.toBytes(genPointScalarPair(rng).scalar),
        generateSecretPolynomial: (signers, secret, coeffs, rng) => {
          const res = generateSecretPolynomial(signers, secret, coeffs, rng);
          return { ...res, commitment: res.commitment.map(serializePoint) };
        }
      })
    };
    return Object.freeze(frost);
  }
  var validateSigners, validateCommitmentsNum, AggErr;
  var init_frost = __esm({
    "node_modules/@noble/curves/abstract/frost.js"() {
      init_utils();
      init_utils2();
      init_curve();
      init_fft();
      init_modular();
      validateSigners = (signers, title = "signers") => {
        validateObject(signers, { min: "number", max: "number" }, {}, title);
        asafenumber(signers.min, title + ".min");
        asafenumber(signers.max, title + ".max");
        if (signers.min < 2 || signers.max < 2 || signers.min > signers.max)
          throw new Error("Wrong signers info: min=" + signers.min + " max=" + signers.max);
      };
      validateCommitmentsNum = (signers, len) => {
        if (len < signers.min || len > signers.max)
          throw new Error("Wrong number of commitments=" + len);
      };
      AggErr = class extends Error {
        constructor(msg, cheaters) {
          super(msg);
          // Empty means aggregation failed before per-share verification could attribute a signer.
          __publicField(this, "cheaters");
          this.cheaters = cheaters;
        }
      };
    }
  });

  // node_modules/@noble/curves/abstract/oprf.js
  function createOPRF(opts) {
    validateObject(opts, {
      name: "string",
      hash: "function",
      hashToScalar: "function",
      hashToGroup: "function"
    });
    validatePointCons(opts.Point);
    const { name, Point, hash, hashToGroup: hashToGroupHook, hashToScalar } = opts;
    const { Fn } = Point;
    const invertSecret = (value) => invertCt(value, Fn.ORDER);
    const hashToGroup = (msg, ctx) => hashToGroupHook(msg, {
      DST: concatBytes2(asciiToBytes("HashToGroup-"), ctx)
    });
    const hashToScalarPrefixed = (msg, ctx) => hashToScalar(msg, { DST: concatBytes2(_DST_scalarBytes, ctx) });
    const randomScalar = (rng = randomBytes2) => {
      if (typeof rng !== "function")
        throw new TypeError('"rng" expected function, got type=' + typeof rng);
      const t = mapHashToField(rng(getMinHashLength(Fn.ORDER)), Fn.ORDER, Fn.isLE);
      return Fn.isLE ? bytesToNumberLE(t) : bytesToNumberBE(t);
    };
    const msm = (points, scalars) => mulAddUnsafe(Point, points, scalars);
    const getCtx = (mode) => concatBytes2(asciiToBytes("OPRFV1-"), new Uint8Array([mode]), asciiToBytes("-" + name));
    const ctxOPRF = getCtx(0);
    const ctxVOPRF = getCtx(1);
    const ctxPOPRF = getCtx(2);
    function encode(...args) {
      const res2 = [];
      for (const a of args) {
        if (typeof a === "number")
          res2.push(numberToBytesBE(a, 2));
        else if (typeof a === "string")
          res2.push(asciiToBytes(a));
        else {
          abytes2(a);
          res2.push(numberToBytesBE(a.length, 2), a);
        }
      }
      return concatBytes2(...res2);
    }
    const inputBytes = (title, bytes) => {
      abytes2(bytes, void 0, title);
      if (bytes.length > 65535)
        throw new Error(`"${title}" expected Uint8Array of length <= 65535, got length=${bytes.length}`);
      return bytes;
    };
    const hashInput = (...bytes) => hash(encode(...bytes, "Finalize"));
    function getTranscripts(B2, C, D, ctx) {
      const Bm = B2.toBytes();
      const seed = hash(encode(Bm, concatBytes2(asciiToBytes("Seed-"), ctx)));
      const res2 = [];
      for (let i = 0; i < C.length; i++) {
        const Ci = C[i].toBytes();
        const Di = D[i].toBytes();
        const di = hashToScalarPrefixed(encode(seed, i, Ci, Di, "Composite"), ctx);
        res2.push(di);
      }
      return res2;
    }
    function computeComposites(B2, C, D, ctx) {
      const T = getTranscripts(B2, C, D, ctx);
      const M = msm(C, T);
      const Z = msm(D, T);
      return { M, Z };
    }
    function computeCompositesFast(k, B2, C, D, ctx) {
      const T = getTranscripts(B2, C, D, ctx);
      const M = msm(C, T);
      const Z = M.multiply(k);
      return { M, Z };
    }
    function challengeTranscript(B2, M, Z, t2, t3, ctx) {
      const [Bm, a0, a1, a2, a3] = [B2, M, Z, t2, t3].map((i) => i.toBytes());
      return hashToScalarPrefixed(encode(Bm, a0, a1, a2, a3, "Challenge"), ctx);
    }
    function generateProof(ctx, k, B2, C, D, rng) {
      const { M, Z } = computeCompositesFast(k, B2, C, D, ctx);
      const r = randomScalar(rng);
      const t2 = Point.BASE.multiply(r);
      const t3 = M.multiply(r);
      const c = challengeTranscript(B2, M, Z, t2, t3, ctx);
      const s = Fn.sub(r, Fn.mul(c, k));
      return concatBytes2(...[c, s].map((i) => Fn.toBytes(i)));
    }
    function verifyProof(ctx, B2, C, D, proof) {
      abytes2(proof, 2 * Fn.BYTES);
      const { M, Z } = computeComposites(B2, C, D, ctx);
      const [c, s] = [proof.subarray(0, Fn.BYTES), proof.subarray(Fn.BYTES)].map((f) => Fn.fromBytes(f));
      const t2 = msm([Point.BASE, B2], [s, c]);
      const t3 = msm([M, Z], [s, c]);
      const expectedC = challengeTranscript(B2, M, Z, t2, t3, ctx);
      if (!Fn.eql(c, expectedC))
        throw new Error("proof verification failed");
    }
    function generateKeyPair() {
      const skS = randomScalar();
      const pkS = Point.BASE.multiply(skS);
      return { secretKey: Fn.toBytes(skS), publicKey: pkS.toBytes() };
    }
    function deriveKeyPair(ctx, seed, info) {
      abytes2(seed, 32, "seed");
      info = inputBytes("keyInfo", info);
      const dst = concatBytes2(asciiToBytes("DeriveKeyPair"), ctx);
      const msg = concatBytes2(seed, encode(info), Uint8Array.of(0));
      for (let counter = 0; counter <= 255; counter++) {
        msg[msg.length - 1] = counter;
        const skS = hashToScalar(msg, { DST: dst });
        if (Fn.is0(skS))
          continue;
        return {
          secretKey: Fn.toBytes(skS),
          publicKey: Point.BASE.multiply(skS).toBytes()
        };
      }
      throw new Error("Cannot derive key");
    }
    const wirePoint = (label, bytes) => {
      const point = Point.fromBytes(bytes);
      if (point.equals(Point.ZERO))
        throw new Error(label + " point at infinity");
      return point;
    };
    function blind(ctx, input, rng = randomBytes2) {
      input = inputBytes("input", input);
      const blind2 = randomScalar(rng);
      const inputPoint = hashToGroup(input, ctx);
      if (inputPoint.equals(Point.ZERO))
        throw new Error("Input point at infinity");
      const blinded = inputPoint.multiply(blind2);
      return { blind: Fn.toBytes(blind2), blinded: blinded.toBytes() };
    }
    function evaluate(ctx, secretKey, input) {
      input = inputBytes("input", input);
      const skS = Fn.fromBytes(secretKey);
      const inputPoint = hashToGroup(input, ctx);
      if (inputPoint.equals(Point.ZERO))
        throw new Error("Input point at infinity");
      const unblinded = inputPoint.multiply(skS).toBytes();
      return hashInput(input, unblinded);
    }
    const oprf = Object.freeze({
      generateKeyPair,
      deriveKeyPair: (seed, keyInfo) => deriveKeyPair(ctxOPRF, seed, keyInfo),
      blind: (input, rng = randomBytes2) => blind(ctxOPRF, input, rng),
      blindEvaluate(secretKey, blindedPoint) {
        const skS = Fn.fromBytes(secretKey);
        const elm = wirePoint("blinded", blindedPoint);
        return elm.multiply(skS).toBytes();
      },
      finalize(input, blindBytes, evaluatedBytes) {
        input = inputBytes("input", input);
        const blind2 = Fn.fromBytes(blindBytes);
        const evalPoint = wirePoint("evaluated", evaluatedBytes);
        const unblinded = evalPoint.multiply(Fn.inv(blind2)).toBytes();
        return hashInput(input, unblinded);
      },
      evaluate: (secretKey, input) => evaluate(ctxOPRF, secretKey, input)
    });
    const voprf = Object.freeze({
      generateKeyPair,
      deriveKeyPair: (seed, keyInfo) => deriveKeyPair(ctxVOPRF, seed, keyInfo),
      blind: (input, rng = randomBytes2) => blind(ctxVOPRF, input, rng),
      blindEvaluateBatch(secretKey, publicKey, blinded, rng = randomBytes2) {
        if (!Array.isArray(blinded))
          throw new Error("expected array");
        const skS = Fn.fromBytes(secretKey);
        const pkS = wirePoint("public key", publicKey);
        const blindedPoints = blinded.map((i) => wirePoint("blinded", i));
        const evaluated = blindedPoints.map((i) => i.multiply(skS));
        const proof = generateProof(ctxVOPRF, skS, pkS, blindedPoints, evaluated, rng);
        return { evaluated: evaluated.map((i) => i.toBytes()), proof };
      },
      blindEvaluate(secretKey, publicKey, blinded, rng = randomBytes2) {
        const res2 = this.blindEvaluateBatch(secretKey, publicKey, [blinded], rng);
        return { evaluated: res2.evaluated[0], proof: res2.proof };
      },
      finalizeBatch(items, publicKey, proof) {
        if (!Array.isArray(items))
          throw new Error("expected array");
        const pkS = wirePoint("public key", publicKey);
        const blindedPoints = items.map((i) => wirePoint("blinded", i.blinded));
        const evalPoints = items.map((i) => wirePoint("evaluated", i.evaluated));
        verifyProof(ctxVOPRF, pkS, blindedPoints, evalPoints, proof);
        return items.map((i, j) => {
          const input = inputBytes("input", i.input);
          const blind2 = Fn.fromBytes(i.blind);
          const unblinded = evalPoints[j].multiply(Fn.inv(blind2)).toBytes();
          return hashInput(input, unblinded);
        });
      },
      finalize(input, blind2, evaluated, blinded, publicKey, proof) {
        return this.finalizeBatch([{ input, blind: blind2, evaluated, blinded }], publicKey, proof)[0];
      },
      evaluate: (secretKey, input) => evaluate(ctxVOPRF, secretKey, input)
    });
    const poprf = (info) => {
      info = copyBytes(inputBytes("info", info));
      const m = hashToScalarPrefixed(encode("Info", info), ctxPOPRF);
      const T = Point.BASE.multiply(m);
      return Object.freeze({
        generateKeyPair,
        deriveKeyPair: (seed, keyInfo) => deriveKeyPair(ctxPOPRF, seed, keyInfo),
        blind(input, publicKey, rng = randomBytes2) {
          input = inputBytes("input", input);
          const pkS = wirePoint("public key", publicKey);
          const tweakedKey = T.add(pkS);
          if (tweakedKey.equals(Point.ZERO))
            throw new Error("tweakedKey point at infinity");
          const blind2 = randomScalar(rng);
          const inputPoint = hashToGroup(input, ctxPOPRF);
          if (inputPoint.equals(Point.ZERO))
            throw new Error("Input point at infinity");
          const blindedPoint = inputPoint.multiply(blind2);
          return {
            blind: Fn.toBytes(blind2),
            blinded: blindedPoint.toBytes(),
            tweakedKey: tweakedKey.toBytes()
          };
        },
        blindEvaluateBatch(secretKey, blinded, rng = randomBytes2) {
          if (!Array.isArray(blinded))
            throw new Error("expected array");
          const skS = Fn.fromBytes(secretKey);
          const t = Fn.add(skS, m);
          const invT = invertSecret(t);
          const blindedPoints = blinded.map((i) => wirePoint("blinded", i));
          const evalPoints = blindedPoints.map((i) => i.multiply(invT));
          const tweakedKey = Point.BASE.multiply(t);
          const proof = generateProof(ctxPOPRF, t, tweakedKey, evalPoints, blindedPoints, rng);
          return { evaluated: evalPoints.map((i) => i.toBytes()), proof };
        },
        blindEvaluate(secretKey, blinded, rng = randomBytes2) {
          const res2 = this.blindEvaluateBatch(secretKey, [blinded], rng);
          return { evaluated: res2.evaluated[0], proof: res2.proof };
        },
        finalizeBatch(items, proof, tweakedKey) {
          if (!Array.isArray(items))
            throw new Error("expected array");
          const inputs = items.map((i) => inputBytes("input", i.input));
          const evalPoints = items.map((i) => wirePoint("evaluated", i.evaluated));
          verifyProof(ctxPOPRF, wirePoint("tweakedKey", tweakedKey), evalPoints, items.map((i) => wirePoint("blinded", i.blinded)), proof);
          return items.map((i, j) => {
            const blind2 = Fn.fromBytes(i.blind);
            const point = evalPoints[j].multiply(Fn.inv(blind2)).toBytes();
            return hashInput(inputs[j], info, point);
          });
        },
        finalize(input, blind2, evaluated, blinded, proof, tweakedKey) {
          return this.finalizeBatch([{ input, blind: blind2, evaluated, blinded }], proof, tweakedKey)[0];
        },
        evaluate(secretKey, input) {
          input = inputBytes("input", input);
          const skS = Fn.fromBytes(secretKey);
          const inputPoint = hashToGroup(input, ctxPOPRF);
          if (inputPoint.equals(Point.ZERO))
            throw new Error("Input point at infinity");
          const t = Fn.add(skS, m);
          const invT = invertSecret(t);
          const unblinded = inputPoint.multiply(invT).toBytes();
          return hashInput(input, info, unblinded);
        }
      });
    };
    const res = { name, oprf, voprf, poprf, __tests: Object.freeze({ Fn, invertSecret }) };
    return Object.freeze(res);
  }
  var _DST_scalarBytes;
  var init_oprf = __esm({
    "node_modules/@noble/curves/abstract/oprf.js"() {
      init_utils2();
      init_curve();
      init_hash_to_curve();
      init_modular();
      _DST_scalarBytes = /* @__PURE__ */ asciiToBytes(_DST_scalar);
    }
  });

  // node_modules/@noble/hashes/hmac.js
  var _HMAC, hmac;
  var init_hmac = __esm({
    "node_modules/@noble/hashes/hmac.js"() {
      init_utils();
      _HMAC = class {
        constructor(hash, key) {
          __publicField(this, "oHash");
          __publicField(this, "iHash");
          __publicField(this, "blockLen");
          __publicField(this, "outputLen");
          __publicField(this, "canXOF", false);
          __publicField(this, "finished", false);
          __publicField(this, "destroyed", false);
          ahash(hash);
          abytes(key, void 0, "key");
          this.iHash = hash.create();
          if (typeof this.iHash.update !== "function")
            throw new Error("expected Hash instance");
          this.blockLen = this.iHash.blockLen;
          this.outputLen = this.iHash.outputLen;
          const blockLen = this.blockLen;
          const pad = new Uint8Array(blockLen);
          pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
          for (let i = 0; i < pad.length; i++)
            pad[i] ^= 54;
          this.iHash.update(pad);
          this.oHash = hash.create();
          for (let i = 0; i < pad.length; i++)
            pad[i] ^= 54 ^ 92;
          this.oHash.update(pad);
          clean(pad);
        }
        update(buf) {
          aexists(this);
          this.iHash.update(buf);
          return this;
        }
        digestInto(out) {
          aexists(this);
          aoutput(out, this);
          this.finished = true;
          const buf = out.subarray(0, this.outputLen);
          this.iHash.digestInto(buf);
          this.oHash.update(buf);
          this.oHash.digestInto(buf);
          this.destroy();
        }
        digest() {
          const out = new Uint8Array(this.oHash.outputLen);
          this.digestInto(out);
          return out;
        }
        _cloneInto(to) {
          to || (to = Object.create(Object.getPrototypeOf(this), {}));
          const { oHash, iHash, finished, destroyed, blockLen, outputLen, canXOF } = this;
          to = to;
          to.finished = finished;
          to.destroyed = destroyed;
          to.blockLen = blockLen;
          to.outputLen = outputLen;
          to.canXOF = canXOF;
          to.oHash = oHash._cloneInto(to.oHash);
          to.iHash = iHash._cloneInto(to.iHash);
          return to;
        }
        clone() {
          return this._cloneInto();
        }
        destroy() {
          this.destroyed = true;
          this.oHash.destroy();
          this.iHash.destroy();
        }
      };
      hmac = /* @__PURE__ */ (() => {
        const hmac_ = ((hash, key, message) => new _HMAC(hash, key).update(message).digest());
        hmac_.create = (hash, key) => new _HMAC(hash, key);
        return hmac_;
      })();
    }
  });

  // node_modules/@noble/curves/abstract/der.js
  var _0n5, DERErr, _DER, DER;
  var init_der = __esm({
    "node_modules/@noble/curves/abstract/der.js"() {
      init_utils2();
      _0n5 = /* @__PURE__ */ BigInt(0);
      DERErr = class extends Error {
        constructor(m = "") {
          super(m);
        }
      };
      _DER = {
        // asn.1 DER encoding utils
        Err: DERErr,
        // Basic building block is TLV (Tag-Length-Value)
        _tlv: {
          encode: (tag, data) => {
            const { Err: E } = _DER;
            asafenumber(tag, "tag");
            if (tag < 0 || tag > 255)
              throw new E("tlv.encode: wrong tag");
            astring(data, "data");
            if (data.length & 1)
              throw new E("tlv.encode: unpadded data");
            const dataLen = data.length / 2;
            const len = numberToHexUnpadded(dataLen);
            if (len.length / 2 & 128)
              throw new E("tlv.encode: long form length too big");
            const lenLen = dataLen > 127 ? numberToHexUnpadded(len.length / 2 | 128) : "";
            const t = numberToHexUnpadded(tag);
            return t + lenLen + len + data;
          },
          // v - value, l - left bytes (unparsed)
          decode(tag, data) {
            const { Err: E } = _DER;
            data = abytes2(data, void 0, "DER data");
            let pos = 0;
            if (tag < 0 || tag > 255)
              throw new E("tlv.decode: wrong tag");
            if (data.length < 2 || data[pos++] !== tag)
              throw new E("tlv.decode: wrong tlv");
            const first = data[pos++];
            const isLong = !!(first & 128);
            let length = 0;
            if (!isLong)
              length = first;
            else {
              const lenLen = first & 127;
              if (!lenLen)
                throw new E("tlv.decode(long): indefinite length not supported");
              if (lenLen > 4)
                throw new E("tlv.decode(long): byte length is too big");
              const lengthBytes = data.subarray(pos, pos + lenLen);
              if (lengthBytes.length !== lenLen)
                throw new E("tlv.decode: length bytes not complete");
              if (lengthBytes[0] === 0)
                throw new E("tlv.decode(long): zero leftmost byte");
              for (const b of lengthBytes)
                length = length << 8 | b;
              pos += lenLen;
              if (length < 128)
                throw new E("tlv.decode(long): not minimal encoding");
            }
            const v = data.subarray(pos, pos + length);
            if (v.length !== length)
              throw new E("tlv.decode: wrong value length");
            return { v, l: data.subarray(pos + length) };
          }
        },
        // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
        // since we always use positive integers here. It must always be empty:
        // - add zero byte if exists
        // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
        _int: {
          encode(num) {
            const { Err: E } = _DER;
            abignumber(num);
            if (num < _0n5)
              throw new E("integer: negative integers are not allowed");
            let hex = numberToHexUnpadded(num);
            if (Number.parseInt(hex[0], 16) & 8)
              hex = "00" + hex;
            if (hex.length & 1)
              throw new E("unexpected DER parsing assertion: unpadded hex");
            return hex;
          },
          decode(data) {
            const { Err: E } = _DER;
            if (data.length < 1)
              throw new E("invalid signature integer: empty");
            if (data[0] & 128)
              throw new E("invalid signature integer: negative");
            if (data.length > 1 && data[0] === 0 && !(data[1] & 128))
              throw new E("invalid signature integer: unnecessary leading zero");
            return bytesToNumberBE(data);
          }
        },
        toSig(bytes, maxScalarBytes) {
          const { Err: E, _int: int, _tlv: tlv } = _DER;
          if (maxScalarBytes !== void 0) {
            asafenumber(maxScalarBytes, "maxScalarBytes");
            if (maxScalarBytes < 1)
              throw new E("invalid signature: maxScalarBytes must be positive");
          }
          const data = abytes2(bytes, void 0, "signature");
          const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
          if (seqLeftBytes.length)
            throw new E("invalid signature: left bytes after parsing");
          const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
          const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
          if (sLeftBytes.length)
            throw new E("invalid signature: left bytes after parsing");
          if (maxScalarBytes !== void 0 && (rBytes.length > maxScalarBytes || sBytes.length > maxScalarBytes))
            throw new E("invalid signature: integer too large");
          return { r: int.decode(rBytes), s: int.decode(sBytes) };
        },
        hexFromSig(sig) {
          const { _tlv: tlv, _int: int } = _DER;
          validateObject(sig, { r: "bigint", s: "bigint" }, {}, "sig");
          const rs = tlv.encode(2, int.encode(sig.r));
          const ss = tlv.encode(2, int.encode(sig.s));
          const seq = rs + ss;
          return tlv.encode(48, seq);
        }
      };
      DER = /* @__PURE__ */ (() => {
        Object.freeze(_DER._tlv);
        Object.freeze(_DER._int);
        return Object.freeze(_DER);
      })();
    }
  });

  // node_modules/@noble/curves/abstract/weierstrass.js
  function _splitEndoScalar(k, basis, n) {
    aInRange("scalar", k, _0n6, n);
    const [[a1, b1], [a2, b2]] = basis;
    const c1 = divNearest(b2 * k, n);
    const c2 = divNearest(-b1 * k, n);
    let k1 = k - c1 * a1 - c2 * a2;
    let k2 = -c1 * b1 - c2 * b2;
    const k1neg = k1 < _0n6;
    const k2neg = k2 < _0n6;
    if (k1neg)
      k1 = -k1;
    if (k2neg)
      k2 = -k2;
    const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n5;
    if (k1 < _0n6 || k1 >= MAX_NUM || k2 < _0n6 || k2 >= MAX_NUM) {
      throw new Error("splitScalar (endomorphism): failed for k");
    }
    return { k1neg, k1, k2neg, k2 };
  }
  function validateSigFormat(format) {
    if (!["compact", "recovered", "der"].includes(format))
      throw new Error('Signature format must be "compact", "recovered", or "der"');
    return format;
  }
  function validateSigOpts(opts, def) {
    validateObject(opts);
    const optsn = {};
    for (let optName of Object.keys(def)) {
      optsn[optName] = opts[optName] === void 0 ? def[optName] : opts[optName];
    }
    abool2(optsn.lowS, "lowS");
    abool2(optsn.prehash, "prehash");
    if (optsn.format !== void 0)
      validateSigFormat(optsn.format);
    return optsn;
  }
  function weierstrass(params, extraOpts = {}) {
    const validated = createCurveFields("weierstrass", params, extraOpts);
    const Fp = validated.Fp;
    const Fn = validated.Fn;
    let CURVE = validated.CURVE;
    const { h: cofactor, n: CURVE_ORDER } = CURVE;
    validateObject(extraOpts, {}, {
      allowInfinityPoint: "boolean",
      clearCofactor: "function",
      isTorsionFree: "function",
      fromBytes: "function",
      toBytes: "function",
      endo: "object",
      randomBytes: "function"
    });
    const { endo: endoOpts, allowInfinityPoint, clearCofactor, isTorsionFree, fromBytes, toBytes } = extraOpts;
    const randomBytes3 = extraOpts.randomBytes === void 0 ? randomBytes2 : extraOpts.randomBytes;
    if (endoOpts) {
      if (!Fp.is0(CURVE.a) || typeof endoOpts.beta !== "bigint" || !Array.isArray(endoOpts.basises)) {
        throw new Error('invalid endo: expected "beta": bigint and "basises": array');
      }
    }
    const endo = endoOpts ? {
      beta: endoOpts.beta,
      basises: endoOpts.basises.map((basis) => [...basis])
    } : void 0;
    const lengths = getWLengths(Fp, Fn);
    function assertCompressionIsSupported() {
      if (!Fp.isOdd)
        throw new Error("compression is not supported: Field does not have .isOdd()");
    }
    function pointToBytes(_c, point, isCompressed) {
      if (point.is0()) {
        if (!allowInfinityPoint)
          throw new Error("bad point: ZERO");
        return Uint8Array.of(0);
      }
      const { x, y } = point.toAffine();
      const bx = Fp.toBytes(x);
      abool2(isCompressed, "isCompressed");
      if (isCompressed) {
        assertCompressionIsSupported();
        const hasEvenY = !Fp.isOdd(y);
        return concatBytes2(pprefix(hasEvenY), bx);
      } else {
        return concatBytes2(Uint8Array.of(4), bx, Fp.toBytes(y));
      }
    }
    function pointFromBytes(bytes) {
      abytes2(bytes, void 0, "Point");
      const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
      const length = bytes.length;
      const head = bytes[0];
      const tail = bytes.subarray(1);
      if (allowInfinityPoint && length === 1 && head === 0)
        return { x: Fp.ZERO, y: Fp.ZERO };
      if (length === comp && (head === 2 || head === 3)) {
        const x = Fp.fromBytes(tail);
        if (!Fp.isValid(x))
          throw new Error("bad point: is not on curve, wrong x");
        const y2 = weierstrassEquation(x);
        let y;
        try {
          y = Fp.sqrt(y2);
        } catch (sqrtError) {
          const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
          throw new Error("bad point: is not on curve, sqrt error" + err);
        }
        assertCompressionIsSupported();
        const evenY = Fp.isOdd(y);
        const evenH = (head & 1) === 1;
        if (evenH !== evenY)
          y = Fp.neg(y);
        return { x, y };
      } else if (length === uncomp && head === 4) {
        const L = Fp.BYTES;
        const x = Fp.fromBytes(tail.subarray(0, L));
        const y = Fp.fromBytes(tail.subarray(L, L * 2));
        if (!isValidXY(x, y))
          throw new Error("bad point: is not on curve");
        return { x, y };
      } else {
        throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
      }
    }
    const encodePoint = toBytes === void 0 ? pointToBytes : toBytes;
    const decodePoint = fromBytes === void 0 ? pointFromBytes : fromBytes;
    const b3 = Fp.mul(CURVE.b, _3n3);
    const mulA = Fp.is0(CURVE.a) ? (_) => Fp.ZERO : (x) => Fp.mul(CURVE.a, x);
    function weierstrassEquation(x) {
      const x2 = Fp.sqr(x);
      const x3 = Fp.mul(x2, x);
      return Fp.add(Fp.add(x3, Fp.mul(x, CURVE.a)), CURVE.b);
    }
    function isValidXY(x, y) {
      const left = Fp.sqr(y);
      const right = weierstrassEquation(x);
      return Fp.eql(left, right);
    }
    if (!isValidXY(CURVE.Gx, CURVE.Gy))
      throw new Error("bad curve params: generator point");
    const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n3), _4n4);
    const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
    if (Fp.is0(Fp.add(_4a3, _27b2)))
      throw new Error("bad curve params: a or b");
    function acoord(title, n, banZero = false) {
      if (!Fp.isValid(n) || banZero && Fp.is0(n))
        throw new Error(`bad point coordinate ${title}`);
      return typeof n === "object" && n !== null ? Fp.create(n) : n;
    }
    function aprjpoint(other) {
      if (!(other instanceof Point))
        throw new Error("Weierstrass Point expected");
    }
    function splitEndoScalarN(k) {
      if (!endo || !endo.basises)
        throw new Error("no endo");
      return _splitEndoScalar(k, endo.basises, Fn.ORDER);
    }
    function pushWnafPair(points, scalars, p, k) {
      if (!Fn.isValid(k))
        throw new RangeError("invalid scalar: out of range");
      if (endo) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(k);
        const psi = new Point(Fp.mul(p.X, endo.beta), p.Y, p.Z);
        points.push(k1neg ? p.negate() : p, k2neg ? psi.negate() : psi);
        scalars.push(k1, k2);
      } else {
        points.push(p);
        scalars.push(k);
      }
    }
    const validityCache = /* @__PURE__ */ new WeakSet();
    const _Point = class _Point {
      /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
      constructor(X, Y, Z) {
        __publicField(this, "X");
        __publicField(this, "Y");
        __publicField(this, "Z");
        this.X = acoord("x", X);
        this.Y = acoord("y", Y, true);
        this.Z = acoord("z", Z);
        Object.freeze(this);
      }
      static CURVE() {
        return CURVE;
      }
      /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
      static fromAffine(p) {
        const { x, y } = p || {};
        if (!p || !Fp.isValid(x) || !Fp.isValid(y))
          throw new Error("invalid affine point");
        if (p instanceof _Point)
          throw new Error("projective point not allowed");
        if (Fp.is0(x) && Fp.is0(y))
          return _Point.ZERO;
        return new _Point(x, y, Fp.ONE);
      }
      static fromBytes(bytes) {
        const P = _Point.fromAffine(decodePoint(abytes2(bytes, void 0, "point")));
        P.assertValidity();
        return P;
      }
      static fromHex(hex) {
        return _Point.fromBytes(hexToBytes2(hex));
      }
      get x() {
        return this.toAffine().x;
      }
      get y() {
        return this.toAffine().y;
      }
      /**
       * @param isLazy - true will defer table computation until the first multiplication
       */
      precompute(windowSize = 6, isLazy = true) {
        wnaf.setWindowSize(this, windowSize);
        if (!isLazy)
          this.multiply(_3n3);
        return this;
      }
      // TODO: return `this`
      /** A point on curve is valid if it conforms to equation. */
      assertValidity() {
        const p = this;
        if (p.is0()) {
          if (allowInfinityPoint && Fp.is0(p.X) && Fp.eql(p.Y, Fp.ONE) && Fp.is0(p.Z))
            return;
          throw new Error("bad point: ZERO");
        }
        if (validityCache.has(p))
          return;
        const { x, y } = p.toAffine();
        if (!Fp.isValid(x) || !Fp.isValid(y))
          throw new Error("bad point: x or y not field elements");
        if (!isValidXY(x, y))
          throw new Error("bad point: equation left != right");
        if (!p.isTorsionFree())
          throw new Error("bad point: not in prime-order subgroup");
        validityCache.add(p);
      }
      hasEvenY() {
        const { y } = this.toAffine();
        if (!Fp.isOdd)
          throw new Error("Field doesn't support isOdd");
        return !Fp.isOdd(y);
      }
      /** Compare one point to another. */
      equals(other) {
        aprjpoint(other);
        const { X: X1, Y: Y1, Z: Z1 } = this;
        const { X: X2, Y: Y2, Z: Z2 } = other;
        const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
        const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
        return U1 && U2;
      }
      /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
      negate() {
        return new _Point(this.X, Fp.neg(this.Y), this.Z);
      }
      // Renes-Costello-Batina exception-free doubling formula.
      // There is 30% faster Jacobian formula, but it is not complete.
      // https://eprint.iacr.org/2015/1060, algorithm 3
      // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
      double() {
        const { X: X1, Y: Y1, Z: Z1 } = this;
        let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
        let t0 = Fp.mul(X1, X1);
        let t1 = Fp.mul(Y1, Y1);
        let t2 = Fp.mul(Z1, Z1);
        let t3 = Fp.mul(X1, Y1);
        t3 = Fp.add(t3, t3);
        Z3 = Fp.mul(X1, Z1);
        Z3 = Fp.add(Z3, Z3);
        X3 = mulA(Z3);
        Y3 = Fp.mul(b3, t2);
        Y3 = Fp.add(X3, Y3);
        X3 = Fp.sub(t1, Y3);
        Y3 = Fp.add(t1, Y3);
        Y3 = Fp.mul(X3, Y3);
        X3 = Fp.mul(t3, X3);
        Z3 = Fp.mul(b3, Z3);
        t2 = mulA(t2);
        t3 = Fp.sub(t0, t2);
        t3 = mulA(t3);
        t3 = Fp.add(t3, Z3);
        Z3 = Fp.add(t0, t0);
        t0 = Fp.add(Z3, t0);
        t0 = Fp.add(t0, t2);
        t0 = Fp.mul(t0, t3);
        Y3 = Fp.add(Y3, t0);
        t2 = Fp.mul(Y1, Z1);
        t2 = Fp.add(t2, t2);
        t0 = Fp.mul(t2, t3);
        X3 = Fp.sub(X3, t0);
        Z3 = Fp.mul(t2, t1);
        Z3 = Fp.add(Z3, Z3);
        Z3 = Fp.add(Z3, Z3);
        return new _Point(X3, Y3, Z3);
      }
      // Renes-Costello-Batina exception-free addition formula.
      // There is 30% faster Jacobian formula, but it is not complete.
      // https://eprint.iacr.org/2015/1060, algorithm 1
      // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
      add(other) {
        aprjpoint(other);
        const { X: X1, Y: Y1, Z: Z1 } = this;
        const { X: X2, Y: Y2, Z: Z2 } = other;
        let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
        let t0 = Fp.mul(X1, X2);
        let t1 = Fp.mul(Y1, Y2);
        let t2 = Fp.mul(Z1, Z2);
        let t3 = Fp.add(X1, Y1);
        let t4 = Fp.add(X2, Y2);
        t3 = Fp.mul(t3, t4);
        t4 = Fp.add(t0, t1);
        t3 = Fp.sub(t3, t4);
        t4 = Fp.add(X1, Z1);
        let t5 = Fp.add(X2, Z2);
        t4 = Fp.mul(t4, t5);
        t5 = Fp.add(t0, t2);
        t4 = Fp.sub(t4, t5);
        t5 = Fp.add(Y1, Z1);
        X3 = Fp.add(Y2, Z2);
        t5 = Fp.mul(t5, X3);
        X3 = Fp.add(t1, t2);
        t5 = Fp.sub(t5, X3);
        Z3 = mulA(t4);
        X3 = Fp.mul(b3, t2);
        Z3 = Fp.add(X3, Z3);
        X3 = Fp.sub(t1, Z3);
        Z3 = Fp.add(t1, Z3);
        Y3 = Fp.mul(X3, Z3);
        t1 = Fp.add(t0, t0);
        t1 = Fp.add(t1, t0);
        t2 = mulA(t2);
        t4 = Fp.mul(b3, t4);
        t1 = Fp.add(t1, t2);
        t2 = Fp.sub(t0, t2);
        t2 = mulA(t2);
        t4 = Fp.add(t4, t2);
        t0 = Fp.mul(t1, t4);
        Y3 = Fp.add(Y3, t0);
        t0 = Fp.mul(t5, t4);
        X3 = Fp.mul(t3, X3);
        X3 = Fp.sub(X3, t0);
        t0 = Fp.mul(t3, t1);
        Z3 = Fp.mul(t5, Z3);
        Z3 = Fp.add(Z3, t0);
        return new _Point(X3, Y3, Z3);
      }
      subtract(other) {
        aprjpoint(other);
        return this.add(other.negate());
      }
      is0() {
        return this.equals(_Point.ZERO);
      }
      /**
       * Constant time multiplication.
       * Uses precomputed tables (signed fixed-window wNAF) when available.
       * Uses scalar blinding and avoids endomorphism splitting in the secret-scalar path.
       * @param scalar - by which the point would be multiplied
       * @returns New point
       */
      multiply(scalar) {
        if (!Fn.isValidNot0(scalar))
          throw new RangeError("invalid scalar: out of range");
        const { p, f } = wnaf.mulSecret(this, scalar, cofactor, normalize);
        return normalize([p, f])[0];
      }
      /**
       * Non-constant-time multiplication. Uses width-4 wNAF with GLV endomorphism splitting
       * when available (two half-width scalars sharing one halved doubling chain).
       * It's faster, but should only be used when you don't care about
       * an exposed secret key e.g. sig verification, which works over *public* keys.
       */
      multiplyUnsafe(scalar) {
        const p = this;
        const sc = scalar;
        if (!Fn.isValid(sc))
          throw new RangeError("invalid scalar: out of range");
        if (sc === _0n6 || p.is0())
          return _Point.ZERO;
        if (sc === _1n5)
          return p;
        if (wnaf.hasWindowSize(this))
          return wnaf.mulUnsafe(p, sc, normalize);
        const points = [];
        const scalars = [];
        pushWnafPair(points, scalars, p, sc);
        return mulAddUnsafe(_Point, points, scalars);
      }
      /**
       * Non-constant-time double-scalar multiplication `a⋅this + b⋅other` (Strauss–Shamir).
       * Both walks share one doubling chain via {@link mulAddUnsafe}, and GLV endomorphism
       * (when available) halves the chain again by splitting each scalar into two half-width
       * parts. Used by ECDSA verification and public-key recovery for `R = u1⋅G + u2⋅P`.
       * Only for public scalars.
       */
      mulAddUnsafe(a, other, b) {
        aprjpoint(other);
        const points = [];
        const scalars = [];
        pushWnafPair(points, scalars, this, a);
        pushWnafPair(points, scalars, other, b);
        return mulAddUnsafe(_Point, points, scalars);
      }
      /**
       * Converts Projective point to affine (x, y) coordinates.
       * (X, Y, Z) ∋ (x=X/Z, y=Y/Z).
       * @param invertedZ - Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
       */
      toAffine(invertedZ) {
        const p = this;
        let iz = invertedZ;
        if (iz != null && !Fp.isValid(iz))
          throw new RangeError('"invertedZ" expected valid field element');
        const { X, Y, Z } = p;
        if (Fp.eql(Z, Fp.ONE))
          return { x: X, y: Y };
        const is0 = p.is0();
        if (iz == null)
          iz = is0 ? Fp.ONE : Fp.inv(Z);
        const x = Fp.mul(X, iz);
        const y = Fp.mul(Y, iz);
        const zz = Fp.mul(Z, iz);
        if (is0)
          return { x: Fp.ZERO, y: Fp.ZERO };
        if (!Fp.eql(zz, Fp.ONE))
          throw new Error("invZ was invalid");
        return { x, y };
      }
      /**
       * Checks whether Point is free of torsion elements (is in prime subgroup).
       * Always torsion-free for cofactor=1 curves.
       */
      isTorsionFree() {
        if (cofactor === _1n5)
          return true;
        if (isTorsionFree)
          return isTorsionFree(_Point, this);
        return wnaf.mulUnsafe(this, CURVE_ORDER).is0();
      }
      clearCofactor() {
        if (cofactor === _1n5)
          return this;
        if (clearCofactor)
          return clearCofactor(_Point, this);
        return this.multiplyUnsafe(cofactor);
      }
      isSmallOrder() {
        if (cofactor === _1n5)
          return this.is0();
        return this.clearCofactor().is0();
      }
      toBytes(isCompressed = true) {
        abool2(isCompressed, "isCompressed");
        this.assertValidity();
        return encodePoint(_Point, this, isCompressed);
      }
      toHex(isCompressed = true) {
        return bytesToHex2(this.toBytes(isCompressed));
      }
      toString() {
        return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
      }
    };
    __publicField(_Point, "BASE", new _Point(CURVE.Gx, CURVE.Gy, Fp.ONE));
    __publicField(_Point, "ZERO", new _Point(Fp.ZERO, Fp.ONE, Fp.ZERO));
    __publicField(_Point, "Fp", Fp);
    __publicField(_Point, "Fn", Fn);
    let Point = _Point;
    const normalize = (points) => normalizeZ(Point, points);
    const wnaf = new ScalarMultiplier(Point, randomBytes3);
    if (wnaf.bits >= 6)
      Point.BASE.precompute(6);
    Object.freeze(Point.prototype);
    Object.freeze(Point);
    return Point;
  }
  function pprefix(hasEvenY) {
    return Uint8Array.of(hasEvenY ? 2 : 3);
  }
  function getWLengths(Fp, Fn) {
    return {
      secretKey: Fn.BYTES,
      publicKey: 1 + Fp.BYTES,
      publicKeyUncompressed: 1 + 2 * Fp.BYTES,
      publicKeyHasPrefix: true,
      // Raw compact `(r || s)` signature width; DER and recovered signatures use
      // different lengths outside this helper.
      signature: 2 * Fn.BYTES
    };
  }
  function ecdh(Point, ecdhOpts = {}) {
    validatePointCons(Point);
    const { Fn } = Point;
    const randomBytes_ = ecdhOpts.randomBytes === void 0 ? randomBytes2 : ecdhOpts.randomBytes;
    const lengths = Object.assign(getWLengths(Point.Fp, Fn), {
      seed: Math.max(getMinHashLength(Fn.ORDER), 16)
    });
    function isValidSecretKey(secretKey) {
      try {
        const num = Fn.fromBytes(secretKey);
        return Fn.isValidNot0(num);
      } catch (error) {
        return false;
      }
    }
    function isValidPublicKey(publicKey, isCompressed) {
      const { publicKey: comp, publicKeyUncompressed } = lengths;
      try {
        const l = publicKey.length;
        if (isCompressed === true && l !== comp)
          return false;
        if (isCompressed === false && l !== publicKeyUncompressed)
          return false;
        return !Point.fromBytes(publicKey).is0();
      } catch (error) {
        return false;
      }
    }
    function randomSecretKey(seed) {
      seed = seed === void 0 ? randomBytes_(lengths.seed) : seed;
      return mapHashToField(abytes2(seed, lengths.seed, "seed"), Fn.ORDER);
    }
    function getPublicKey(secretKey, isCompressed = true) {
      return Point.BASE.multiply(Fn.fromBytes(secretKey)).toBytes(isCompressed);
    }
    function isProbPub(item) {
      const { secretKey, publicKey, publicKeyUncompressed } = lengths;
      const allowedLengths = Fn._lengths;
      if (!isBytes2(item))
        return void 0;
      const l = abytes2(item, void 0, "key").length;
      const isPub = l === publicKey || l === publicKeyUncompressed;
      const isSec = l === secretKey || !!allowedLengths?.includes(l);
      if (isPub && isSec)
        return void 0;
      return isPub;
    }
    function getSharedSecret(secretKeyA, publicKeyB, isCompressed = true) {
      if (isProbPub(secretKeyA) === true)
        throw new Error("first arg must be private key");
      if (isProbPub(publicKeyB) === false)
        throw new Error("second arg must be public key");
      const s = Fn.fromBytes(secretKeyA);
      const b = Point.fromBytes(publicKeyB);
      if (b.is0())
        throw new Error("invalid public key: point at infinity");
      return b.multiply(s).toBytes(isCompressed);
    }
    const utils = {
      isValidSecretKey,
      isValidPublicKey,
      randomSecretKey
    };
    const keygen = createKeygen(randomSecretKey, getPublicKey);
    Object.freeze(utils);
    Object.freeze(lengths);
    return Object.freeze({ getPublicKey, getSharedSecret, keygen, Point, utils, lengths });
  }
  function ecdsa(Point, hash, ecdsaOpts = {}) {
    validatePointCons(Point);
    const hash_ = hash;
    ahash(hash_);
    validateObject(ecdsaOpts, {}, {
      hmac: "function",
      lowS: "boolean",
      randomBytes: "function",
      bits2int: "function",
      bits2int_modN: "function"
    });
    const opts = Object.assign({}, ecdsaOpts);
    const randomBytes3 = opts.randomBytes === void 0 ? randomBytes2 : opts.randomBytes;
    const hmac2 = opts.hmac === void 0 ? (key, msg) => hmac(hash_, key, msg) : opts.hmac;
    const { Fp, Fn } = Point;
    const { ORDER: CURVE_ORDER, BITS: fnBits } = Fn;
    const blindLength = getMinHashLength(CURVE_ORDER);
    const csprng = probeRandomBytes(randomBytes3, blindLength);
    const { keygen, getPublicKey, getSharedSecret, utils, lengths } = ecdh(Point, opts);
    const defaultSigOpts = {
      prehash: true,
      lowS: typeof opts.lowS === "boolean" ? opts.lowS : true,
      format: "compact",
      extraEntropy: false
    };
    const hasLargeRecoveryLifts = CURVE_ORDER * _2n3 + _1n5 < Fp.ORDER;
    function isBiggerThanHalfOrder(number) {
      const HALF = CURVE_ORDER >> _1n5;
      return number > HALF;
    }
    function validateRS(title, num) {
      if (!Fn.isValidNot0(num))
        throw new Error(`invalid signature ${title}: out of range 1..Point.Fn.ORDER`);
      return num;
    }
    function assertFieldSignIsSupported() {
      if (!Fp.isOdd)
        throw new Error("Field doesn't support isOdd");
    }
    function getRecoveryBit(x, y, r) {
      assertFieldSignIsSupported();
      return (x === r ? 0 : 2) | Number(Fp.isOdd(y));
    }
    function assertRecoverableCurve() {
      if (hasLargeRecoveryLifts)
        throw new Error('"recovered" sig type is not supported for cofactor >2 curves');
    }
    function validateSigLength(bytes, format) {
      validateSigFormat(format);
      const size = lengths.signature;
      const sizer = format === "compact" ? size : format === "recovered" ? size + 1 : void 0;
      return abytes2(bytes, sizer);
    }
    class Signature {
      constructor(r, s, recovery) {
        __publicField(this, "r");
        __publicField(this, "s");
        __publicField(this, "recovery");
        this.r = validateRS("r", r);
        this.s = validateRS("s", s);
        if (recovery != null) {
          assertRecoverableCurve();
          if (![0, 1, 2, 3].includes(recovery))
            throw new Error("invalid recovery id");
          this.recovery = recovery;
        }
        Object.freeze(this);
      }
      static fromBytes(bytes, format = defaultSigOpts.format) {
        validateSigLength(bytes, format);
        let recid;
        if (format === "der") {
          if (bytes.length > 2 * Fn.BYTES + 16)
            throw new DER.Err("invalid signature: DER signature too long");
          const { r: r2, s: s2 } = DER.toSig(abytes2(bytes), Fn.BYTES + 1);
          return new Signature(r2, s2);
        }
        if (format === "recovered") {
          recid = bytes[0];
          format = "compact";
          bytes = bytes.subarray(1);
        }
        const L = lengths.signature / 2;
        const r = bytes.subarray(0, L);
        const s = bytes.subarray(L, L * 2);
        return new Signature(Fn.fromBytes(r), Fn.fromBytes(s), recid);
      }
      static fromHex(hex, format) {
        return this.fromBytes(hexToBytes2(hex), format);
      }
      assertRecovery() {
        const { recovery } = this;
        if (recovery == null)
          throw new Error("invalid recovery id: must be present");
        return recovery;
      }
      addRecoveryBit(recovery) {
        return new Signature(this.r, this.s, recovery);
      }
      // Unlike the top-level helper below, this method expects a digest that has
      // already been hashed to the curve's message representative.
      recoverPublicKey(messageHash) {
        const { r, s } = this;
        const recovery = this.assertRecovery();
        const radj = recovery === 2 || recovery === 3 ? r + CURVE_ORDER : r;
        if (!Fp.isValid(radj))
          throw new Error("invalid recovery id: sig.r+curve.n != R.x");
        const x = Fp.toBytes(radj);
        const R = Point.fromBytes(concatBytes2(pprefix((recovery & 1) === 0), x));
        const ir = Fn.inv(radj);
        const h = bits2int_modN(abytes2(messageHash, void 0, "msgHash"));
        const u1 = Fn.create(-h * ir);
        const u2 = Fn.create(s * ir);
        const Q = Point.BASE.mulAddUnsafe(u1, R, u2);
        if (Q.is0())
          throw new Error("invalid recovery: point at infinify");
        Q.assertValidity();
        return Q;
      }
      // Signatures should be low-s, to prevent malleability.
      hasHighS() {
        return isBiggerThanHalfOrder(this.s);
      }
      toBytes(format = defaultSigOpts.format) {
        validateSigFormat(format);
        if (format === "der")
          return hexToBytes2(DER.hexFromSig(this));
        const { r, s } = this;
        const rb = Fn.toBytes(r);
        const sb = Fn.toBytes(s);
        if (format === "recovered") {
          assertRecoverableCurve();
          return concatBytes2(Uint8Array.of(this.assertRecovery()), rb, sb);
        }
        return concatBytes2(rb, sb);
      }
      toHex(format) {
        return bytesToHex2(this.toBytes(format));
      }
    }
    Object.freeze(Signature.prototype);
    Object.freeze(Signature);
    const bits2int = opts.bits2int === void 0 ? function bits2int_def(bytes) {
      if (bytes.length > 8192)
        throw new Error("input is too large");
      const num = bytesToNumberBE(bytes);
      const delta = bytes.length * 8 - fnBits;
      return delta > 0 ? num >> BigInt(delta) : num;
    } : opts.bits2int;
    const bits2int_modN = opts.bits2int_modN === void 0 ? function bits2int_modN_def(bytes) {
      return Fn.create(bits2int(bytes));
    } : opts.bits2int_modN;
    const ORDER_MASK = bitMask(fnBits);
    function int2octets(num) {
      aInRange("num < 2^" + fnBits, num, _0n6, ORDER_MASK);
      return Fn.toBytes(num);
    }
    function validateMsgAndHash(message, prehash) {
      abytes2(message, void 0, "message");
      return prehash ? abytes2(hash_(message), void 0, "prehashed message") : message;
    }
    function prepSig(message, secretKey, opts2) {
      const { lowS, prehash, extraEntropy } = validateSigOpts(opts2, defaultSigOpts);
      message = validateMsgAndHash(message, prehash);
      const h1int = bits2int_modN(message);
      const d = Fn.fromBytes(secretKey);
      if (!Fn.isValidNot0(d))
        throw new Error("invalid private key");
      const seedArgs = [int2octets(d), int2octets(h1int)];
      if (extraEntropy != null && extraEntropy !== false) {
        const e = extraEntropy === true ? randomBytes3(lengths.secretKey) : extraEntropy;
        seedArgs.push(abytes2(e, void 0, "extraEntropy"));
      }
      const seed = concatBytes2(...seedArgs);
      const m = h1int;
      function k2sig(kBytes) {
        const k = bits2int(kBytes);
        if (!Fn.isValidNot0(k))
          return;
        const q = Point.BASE.multiply(k).toAffine();
        const r = Fn.create(q.x);
        if (r === _0n6)
          return;
        let s;
        if (csprng !== void 0) {
          const b = bytesToNumberBE(mapHashToField(csprng(blindLength), CURVE_ORDER));
          const ibk = Fn.inv(Fn.mul(b, k));
          const bm = Fn.mul(b, m);
          const bd = Fn.mul(b, d);
          s = Fn.create(ibk * Fn.create(bm + bd * r));
        } else {
          const ik = invertCt(k, CURVE_ORDER);
          s = Fn.create(ik * Fn.create(m + r * d));
        }
        if (s === _0n6)
          return;
        let recovery = getRecoveryBit(q.x, q.y, r);
        let normS = s;
        if (lowS && isBiggerThanHalfOrder(s)) {
          normS = Fn.neg(s);
          recovery ^= 1;
        }
        return new Signature(r, normS, hasLargeRecoveryLifts ? void 0 : recovery);
      }
      return { seed, k2sig };
    }
    function sign(message, secretKey, opts2 = {}) {
      const { seed, k2sig } = prepSig(message, secretKey, opts2);
      const drbg = createHmacDrbg(hash_.outputLen, Fn.BYTES, hmac2);
      const sig = drbg(seed, k2sig);
      return sig.toBytes(opts2.format);
    }
    function verify(signature, message, publicKey, opts2 = {}) {
      const { lowS, prehash, format } = validateSigOpts(opts2, defaultSigOpts);
      publicKey = abytes2(publicKey, void 0, "publicKey");
      message = validateMsgAndHash(message, prehash);
      if (!isBytes2(signature)) {
        const end = signature instanceof Signature ? ", use sig.toBytes()" : "";
        throw new Error("verify expects Uint8Array signature" + end);
      }
      validateSigLength(signature, format);
      try {
        const sig = Signature.fromBytes(signature, format);
        const P = Point.fromBytes(publicKey);
        if (P.is0())
          return false;
        if (lowS && sig.hasHighS())
          return false;
        const { r, s } = sig;
        const h = bits2int_modN(message);
        const is = Fn.inv(s);
        const u1 = Fn.create(h * is);
        const u2 = Fn.create(r * is);
        const R = Point.BASE.mulAddUnsafe(u1, P, u2);
        if (R.is0())
          return false;
        const q = R.toAffine();
        const v = Fn.create(q.x);
        if (v !== r)
          return false;
        if (format === "recovered" && sig.recovery !== getRecoveryBit(q.x, q.y, r))
          return false;
        return true;
      } catch (e) {
        return false;
      }
    }
    function recoverPublicKey(signature, message, opts2 = {}) {
      const { prehash } = validateSigOpts(opts2, defaultSigOpts);
      message = validateMsgAndHash(message, prehash);
      return Signature.fromBytes(signature, "recovered").recoverPublicKey(message).toBytes();
    }
    return Object.freeze({
      keygen,
      getPublicKey,
      getSharedSecret,
      utils,
      lengths,
      Point,
      sign,
      verify,
      recoverPublicKey,
      Signature,
      hash: hash_
    });
  }
  var divNearest, _0n6, _1n5, _2n3, _3n3, _4n4;
  var init_weierstrass = __esm({
    "node_modules/@noble/curves/abstract/weierstrass.js"() {
      init_hmac();
      init_utils();
      init_utils2();
      init_curve();
      init_der();
      init_modular();
      divNearest = (num, den) => (num + (num >= 0 ? den : -den) / _2n3) / den;
      _0n6 = /* @__PURE__ */ BigInt(0);
      _1n5 = /* @__PURE__ */ BigInt(1);
      _2n3 = /* @__PURE__ */ BigInt(2);
      _3n3 = /* @__PURE__ */ BigInt(3);
      _4n4 = /* @__PURE__ */ BigInt(4);
    }
  });

  // node_modules/@noble/curves/nist.js
  var nist_exports = {};
  __export(nist_exports, {
    p256: () => p256,
    p256_FROST: () => p256_FROST,
    p256_hasher: () => p256_hasher,
    p256_oprf: () => p256_oprf,
    p384: () => p384,
    p384_hasher: () => p384_hasher,
    p384_oprf: () => p384_oprf,
    p521: () => p521,
    p521_hasher: () => p521_hasher,
    p521_oprf: () => p521_oprf
  });
  function createSWU(Point, opts) {
    let map;
    return (scalars) => (map || (map = mapToCurveSimpleSWU(Point.Fp, opts)))(scalars[0]);
  }
  var p256_CURVE, p384_CURVE, p521_CURVE, p256_Point, p256, p256_hasher, p256_oprf, p256_FROST, p384_Point, p384, p384_hasher, p384_oprf, p521_Point, p521, p521_hasher, p521_oprf;
  var init_nist = __esm({
    "node_modules/@noble/curves/nist.js"() {
      init_sha2();
      init_frost();
      init_hash_to_curve();
      init_oprf();
      init_weierstrass();
      p256_CURVE = /* @__PURE__ */ (() => ({
        p: BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"),
        n: BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"),
        h: BigInt(1),
        a: BigInt("0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc"),
        b: BigInt("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"),
        Gx: BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),
        Gy: BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")
      }))();
      p384_CURVE = /* @__PURE__ */ (() => ({
        p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffff"),
        n: BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973"),
        h: BigInt(1),
        a: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000fffffffc"),
        b: BigInt("0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aef"),
        Gx: BigInt("0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7"),
        Gy: BigInt("0x3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f")
      }))();
      p521_CURVE = /* @__PURE__ */ (() => ({
        p: BigInt("0x1ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
        n: BigInt("0x01fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa51868783bf2f966b7fcc0148f709a5d03bb5c9b8899c47aebb6fb71e91386409"),
        h: BigInt(1),
        a: BigInt("0x1fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc"),
        b: BigInt("0x0051953eb9618e1c9a1f929a21a0b68540eea2da725b99b315f3b8b489918ef109e156193951ec7e937b1652c0bd3bb1bf073573df883d2c34f1ef451fd46b503f00"),
        Gx: BigInt("0x00c6858e06b70404e9cd9e3ecb662395b4429c648139053fb521f828af606b4d3dbaa14b5e77efe75928fe1dc127a2ffa8de3348b3c1856a429bf97e7e31c2e5bd66"),
        Gy: BigInt("0x011839296a789a3bc0045c8a5fb42c7d1bd998f54449579b446817afbd17273e662c97ee72995ef42640c550b9013fad0761353c7086a272c24088be94769fd16650")
      }))();
      p256_Point = /* @__PURE__ */ weierstrass(p256_CURVE);
      p256 = /* @__PURE__ */ ecdsa(p256_Point, sha256);
      p256_hasher = /* @__PURE__ */ (() => {
        return createHasher2(p256_Point, createSWU(p256_Point, {
          A: p256_CURVE.a,
          B: p256_CURVE.b,
          Z: p256_Point.Fp.neg(BigInt(10))
        }), {
          DST: "P256_XMD:SHA-256_SSWU_RO_",
          encodeDST: "P256_XMD:SHA-256_SSWU_NU_",
          p: p256_CURVE.p,
          m: 1,
          k: 128,
          expand: "xmd",
          hash: sha256
        });
      })();
      p256_oprf = /* @__PURE__ */ (() => createOPRF({
        name: "P256-SHA256",
        Point: p256_Point,
        hash: sha256,
        hashToGroup: p256_hasher.hashToCurve,
        hashToScalar: p256_hasher.hashToScalar
      }))();
      p256_FROST = /* @__PURE__ */ (() => createFROST({
        name: "FROST-P256-SHA256-v1",
        Point: p256_Point,
        hashToScalar: p256_hasher.hashToScalar,
        hash: sha256
      }))();
      p384_Point = /* @__PURE__ */ weierstrass(p384_CURVE);
      p384 = /* @__PURE__ */ ecdsa(p384_Point, sha384);
      p384_hasher = /* @__PURE__ */ (() => {
        return createHasher2(p384_Point, createSWU(p384_Point, {
          A: p384_CURVE.a,
          B: p384_CURVE.b,
          Z: p384_Point.Fp.neg(BigInt(12))
        }), {
          DST: "P384_XMD:SHA-384_SSWU_RO_",
          encodeDST: "P384_XMD:SHA-384_SSWU_NU_",
          p: p384_CURVE.p,
          m: 1,
          k: 192,
          expand: "xmd",
          hash: sha384
        });
      })();
      p384_oprf = /* @__PURE__ */ (() => createOPRF({
        name: "P384-SHA384",
        Point: p384_Point,
        hash: sha384,
        hashToGroup: p384_hasher.hashToCurve,
        hashToScalar: p384_hasher.hashToScalar
      }))();
      p521_Point = /* @__PURE__ */ weierstrass(p521_CURVE);
      p521 = /* @__PURE__ */ ecdsa(p521_Point, sha512);
      p521_hasher = /* @__PURE__ */ (() => {
        return createHasher2(p521_Point, createSWU(p521_Point, {
          A: p521_CURVE.a,
          B: p521_CURVE.b,
          Z: p521_Point.Fp.neg(BigInt(4))
        }), {
          DST: "P521_XMD:SHA-512_SSWU_RO_",
          encodeDST: "P521_XMD:SHA-512_SSWU_NU_",
          p: p521_CURVE.p,
          m: 1,
          k: 256,
          expand: "xmd",
          hash: sha512
        });
      })();
      p521_oprf = /* @__PURE__ */ (() => createOPRF({
        name: "P521-SHA512",
        Point: p521_Point,
        hash: sha512,
        hashToGroup: p521_hasher.hashToCurve,
        hashToScalar: p521_hasher.hashToScalar
        // produces L=98 just like in RFC
      }))();
    }
  });

  // src/device-key.js
  var require_device_key = __commonJS({
    "src/device-key.js"(exports, module) {
      "use strict";
      var p2562 = (init_nist(), __toCommonJS(nist_exports)).p256;
      var sha2562 = (init_sha2(), __toCommonJS(sha2_exports)).sha256;
      var util = require_util();
      var PluginError = util.PluginError;
      var SIGNING_DOMAIN = "codex-device-key-sign-payload/v1";
      var ALGORITHM = "ecdsa_p256_sha256";
      var PROTECTION_CLASS = "os_protected_nonextractable";
      var SPKI_PREFIX = [
        48,
        89,
        48,
        19,
        6,
        7,
        42,
        134,
        72,
        206,
        61,
        2,
        1,
        6,
        8,
        42,
        134,
        72,
        206,
        61,
        3,
        1,
        7,
        3,
        66,
        0
      ];
      function toHex(bytes) {
        var hex = "";
        for (var i = 0; i < bytes.length; i++) hex += ("0" + bytes[i].toString(16)).slice(-2);
        return hex;
      }
      function fromHex(hex) {
        var bytes = new Uint8Array(hex.length / 2);
        for (var i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        return bytes;
      }
      function generate(accountUserId, clientId, seed) {
        var secret = p2562.utils.randomSecretKey(seed);
        var point = p2562.getPublicKey(secret, false);
        var spki = new Uint8Array(SPKI_PREFIX.length + point.length);
        spki.set(SPKI_PREFIX);
        spki.set(point, SPKI_PREFIX.length);
        return {
          accountUserId,
          clientId,
          keyId: "dk_" + util.uuid().replace(/-/g, ""),
          publicKeySpkiDerBase64: util.base64(spki),
          secretHex: toHex(secret)
        };
      }
      function identity(key) {
        return {
          key_id: key.keyId,
          public_key_spki_der_base64: key.publicKeySpkiDerBase64,
          algorithm: ALGORITHM,
          protection_class: PROTECTION_CLASS
        };
      }
      function identityHash(key) {
        var json = JSON.stringify({
          algorithm: ALGORITHM,
          keyId: key.keyId,
          protectionClass: PROTECTION_CLASS,
          publicKeySpkiDerBase64: key.publicKeySpkiDerBase64
        });
        return util.base64url(sha2562(util.utf8(json)));
      }
      function sign(key, payload) {
        var signed = util.utf8(JSON.stringify({ domain: SIGNING_DOMAIN, payload }));
        var signature = p2562.sign(signed, fromHex(key.secretHex), { format: "der" });
        return { signature_der_base64: util.base64(signature), signed_payload_base64: util.base64(signed), algorithm: ALGORITHM };
      }
      function field(challenge, name) {
        if (challenge[name] !== void 0) return challenge[name];
        return challenge[name.replace(/[A-Z]/g, function(c) {
          return "_" + c.toLowerCase();
        })];
      }
      function mismatch() {
        return PluginError("PLUGIN_UNAVAILABLE", "Codex remote control sent an unexpected challenge. Connect your computers again.");
      }
      function signEnrollment(key, challenge, origin, path, requireIdentityHash) {
        var hash = identityHash(key);
        var remoteHash = challenge && field(challenge, "deviceIdentityHash");
        if (!challenge || field(challenge, "accountUserId") !== key.accountUserId || field(challenge, "clientId") !== key.clientId || field(challenge, "targetOrigin") !== origin || field(challenge, "targetPath") !== path || (remoteHash ? remoteHash !== hash : requireIdentityHash)) {
          throw mismatch();
        }
        var proof = sign(key, {
          accountUserId: field(challenge, "accountUserId"),
          audience: field(challenge, "audience"),
          challengeExpiresAt: field(challenge, "challengeExpiresAt"),
          challengeId: field(challenge, "challengeId"),
          clientId: field(challenge, "clientId"),
          deviceIdentitySha256Base64url: hash,
          nonce: field(challenge, "nonce"),
          targetOrigin: field(challenge, "targetOrigin"),
          targetPath: field(challenge, "targetPath"),
          type: "remoteControlClientEnrollment"
        });
        return {
          challenge_token: field(challenge, "challengeToken"),
          key_id: key.keyId,
          signature_der_base64: proof.signature_der_base64,
          signed_payload_base64: proof.signed_payload_base64,
          algorithm: proof.algorithm
        };
      }
      function signConnection(key, challenge) {
        if (field(challenge, "accountUserId") !== key.accountUserId || field(challenge, "clientId") !== key.clientId) throw mismatch();
        var proof = sign(key, {
          accountUserId: field(challenge, "accountUserId"),
          audience: field(challenge, "audience"),
          clientId: field(challenge, "clientId"),
          nonce: field(challenge, "nonce"),
          scopes: field(challenge, "scopes") || [],
          sessionId: field(challenge, "sessionId"),
          targetOrigin: field(challenge, "targetOrigin"),
          targetPath: field(challenge, "targetPath"),
          tokenExpiresAt: field(challenge, "tokenExpiresAt"),
          tokenSha256Base64url: field(challenge, "tokenSha256Base64url"),
          type: "remoteControlClientConnection"
        });
        return {
          type: "device_key_proof",
          keyId: key.keyId,
          signatureDerBase64: proof.signature_der_base64,
          signedPayloadBase64: proof.signed_payload_base64,
          algorithm: proof.algorithm
        };
      }
      module.exports = {
        generate,
        identity,
        identityHash,
        signEnrollment,
        signConnection
      };
    }
  });

  // src/codex-remote.js
  var require_codex_remote = __commonJS({
    "src/codex-remote.js"(exports, module) {
      "use strict";
      var util = require_util();
      var deviceKey = require_device_key();
      var codexHeaders = require_codex_auth().codexHeaders;
      var PluginError = util.PluginError;
      var ORIGIN = "https://chatgpt.com";
      var BASE_PATH = "/backend-api/codex/remote/control";
      var SOCKET_URL = "wss://chatgpt.com" + BASE_PATH + "/client";
      var PROTOCOL_VERSION = "3";
      var KEY = "chatgpt.codex.remote.v1";
      var RENEW_BEFORE_MS = 60 * 1e3;
      var CLIENT_NAME = "Pebble Plugin";
      var CLIENT_INFO = { name: "pebble_plugin", title: CLIENT_NAME, version: "1.0.0" };
      function notConnected() {
        return PluginError("AUTH_REQUIRED", "Connect your computers in the plugin settings first.");
      }
      function environmentName(env) {
        return env.name || env.rawDisplayName || env.raw_display_name || env.hostName || env.host_name || env.id;
      }
      function threadLabel(thread) {
        return thread.name && thread.name.trim() || (thread.preview || "").trim() || thread.id;
      }
      function createCodexRemote(storage, fetch2, now, WebSocketImpl, auth) {
        async function load() {
          var raw = await storage.getItem(KEY);
          return raw ? JSON.parse(raw) : null;
        }
        async function call(account, method, path, body, clientId) {
          var headers = codexHeaders(account);
          headers["x-codex-protocol-version"] = PROTOCOL_VERSION;
          headers["x-codex-name"] = CLIENT_NAME;
          headers["User-Agent"] = CLIENT_NAME;
          if (clientId) headers["x-codex-client-id"] = clientId;
          var response = await fetch2(ORIGIN + BASE_PATH + path, {
            method,
            headers,
            body: body === void 0 ? void 0 : JSON.stringify(body)
          });
          if (response.status < 200 || response.status >= 300) console.error("Codex remote " + method + " " + path + ": HTTP " + response.status);
          if (response.status === 401) throw notConnected();
          if (response.status === 403) {
            throw PluginError("PERMISSION_DENIED", "Codex remote control is not enabled for this ChatGPT account or workspace.");
          }
          if (response.status < 200 || response.status >= 300) {
            throw PluginError("PLUGIN_UNAVAILABLE", "Codex remote control returned an error (HTTP " + response.status + ").");
          }
          return response.json();
        }
        async function save(finish, key, paired) {
          var session = {
            paired: !!paired,
            clientId: finish.client_id,
            accountUserId: finish.account_user_id,
            token: finish.remote_control_token,
            expiresAt: Date.parse(finish.expires_at) || now(),
            key
          };
          await storage.setItem(KEY, JSON.stringify(session));
          return session;
        }
        async function enroll(stepUpToken, seed) {
          var account = await auth.current();
          var start = await call(account, "POST", "/client/enroll/start", {});
          var key = deviceKey.generate(start.account_user_id, start.client_id, seed);
          var proof = deviceKey.signEnrollment(key, start.device_key_challenge, ORIGIN, BASE_PATH + "/client/enroll/finish", false);
          var finish = await call(account, "POST", "/client/enroll/finish", {
            client_id: start.client_id,
            step_up_token: stepUpToken,
            device_identity: deviceKey.identity(key),
            device_key_proof: proof
          }, start.client_id);
          return save(finish, key);
        }
        async function current(account) {
          var session = await load();
          if (!session) throw notConnected();
          if (session.expiresAt - now() > RENEW_BEFORE_MS) return session;
          var start = await call(account, "POST", "/client/refresh/start", { client_id: session.clientId }, session.clientId);
          var proof = deviceKey.signEnrollment(session.key, start.device_key_challenge, ORIGIN, BASE_PATH + "/client/refresh/finish", true);
          var finish = await call(account, "POST", "/client/refresh/finish", {
            client_id: session.clientId,
            device_key_proof: proof
          }, session.clientId);
          return save(finish, session.key, session.paired);
        }
        async function environments(account, session) {
          var body = await call(account, "GET", "/environments", void 0, session.clientId);
          var list = Array.isArray(body) ? body : body && (body.data || body.items || body.environments) || [];
          return list.map(function(env) {
            return { id: env.id || env.env_id, name: environmentName(env), online: !!env.online, busy: !!env.busy };
          });
        }
        async function computers() {
          var account = await auth.current();
          return environments(account, await current(account));
        }
        function open(account, session, environmentId) {
          var streamId = util.uuid();
          var seq = 0;
          var cursor = null;
          var nextId = 1;
          var pending = {};
          var chunks = {};
          var failed = null;
          var ready;
          var socket = new WebSocketImpl(SOCKET_URL, [], {
            headers: {
              "Authorization": "Bearer " + account.accessToken,
              "chatgpt-account-id": account.account,
              "originator": "Codex Desktop",
              "x-codex-protocol-version": PROTOCOL_VERSION,
              "x-codex-client-id": session.clientId,
              "x-codex-client-session-token": "Bearer " + session.token,
              "x-codex-name": CLIENT_NAME,
              "User-Agent": CLIENT_NAME
            }
          });
          var handshake = new Promise(function(resolve, reject) {
            ready = { resolve, reject };
          });
          function fail(error) {
            if (failed) return;
            failed = error;
            ready.reject(error);
            Object.keys(pending).forEach(function(id) {
              pending[id].reject(error);
            });
            pending = {};
          }
          function deliver(message) {
            if (message && message.method === "error" && message.params && message.params.threadId === "__remote_control_transport__") {
              var reason = message.params.error && message.params.error.message;
              var unpaired = /not paired/i.test(reason || "");
              var transportError = PluginError("PLUGIN_UNAVAILABLE", unpaired ? "That computer has not paired this phone for Codex remote control yet. Pair it in plugin settings." : "Codex remote control: " + (reason || "connection failed") + ".");
              transportError.unpaired = unpaired;
              fail(transportError);
              return;
            }
            if (message && message.id !== void 0 && pending[message.id]) {
              var waiter = pending[message.id];
              delete pending[message.id];
              if (message.error) {
                var error = PluginError("PLUGIN_UNAVAILABLE", "Codex: " + (message.error.message || "request failed") + ".");
                error.rpc = message.error;
                waiter.reject(error);
              } else {
                waiter.resolve(message.result);
              }
            }
          }
          socket.onmessage = function(event) {
            var envelope2;
            try {
              envelope2 = JSON.parse(event.data);
            } catch (_) {
              return;
            }
            if (envelope2.type === "device_key_challenge") {
              try {
                socket.send(JSON.stringify(deviceKey.signConnection(session.key, envelope2)));
                ready.resolve();
              } catch (error) {
                fail(error);
              }
              return;
            }
            if (envelope2.cursor) cursor = envelope2.cursor;
            if (envelope2.type === "server_message") {
              deliver(envelope2.message);
            } else if (envelope2.type === "server_message_chunk") {
              var parts = chunks[envelope2.seq_id] = chunks[envelope2.seq_id] || [];
              parts[envelope2.segment_id] = envelope2.message_chunk_base64;
              var complete = 0;
              for (var i = 0; i < envelope2.segment_count; i++) if (parts[i] !== void 0) complete++;
              if (complete === envelope2.segment_count) {
                delete chunks[envelope2.seq_id];
                var bytes = [];
                parts.forEach(function(part) {
                  bytes.push.apply(bytes, Array.from(util.fromBase64(part)));
                });
                deliver(JSON.parse(util.fromUtf8(new Uint8Array(bytes))));
              }
            }
          };
          socket.onerror = function() {
            fail(PluginError("PLUGIN_UNAVAILABLE", "Could not reach Codex remote control."));
          };
          socket.onclose = function() {
            fail(PluginError("PLUGIN_UNAVAILABLE", "Codex remote control closed the connection."));
          };
          function envelope(fields) {
            seq += 1;
            var out = { type: fields.type, client_id: session.clientId, env_id: environmentId, stream_id: streamId, seq_id: seq };
            if (fields.message) out.message = fields.message;
            if (cursor) out.cursor = cursor;
            socket.send(JSON.stringify(out));
          }
          function notify(method, params) {
            var message = { method };
            if (params) message.params = params;
            envelope({ type: "client_message", message });
          }
          function request(method, params) {
            if (failed) return Promise.reject(failed);
            var id = nextId++;
            return new Promise(function(resolve, reject) {
              pending[id] = { resolve, reject };
              envelope({ type: "client_message", message: { id, method, params } });
            });
          }
          async function start() {
            await handshake;
            await request("initialize", { clientInfo: CLIENT_INFO, capabilities: { experimentalApi: true } });
            notify("initialized");
          }
          function close() {
            try {
              if (!failed) envelope({ type: "client_closed" });
              socket.close(1e3, "");
            } catch (_) {
            }
          }
          return { start, request, close };
        }
        function pickComputer(list, query) {
          var online = list.filter(function(env) {
            return env.online;
          });
          if (!online.length) {
            throw PluginError("PLUGIN_UNAVAILABLE", list.length ? "None of your computers is online for Codex remote control." : "No computer is set up for Codex remote control. Turn on remote control in the Codex app or run `codex remote-control start`.");
          }
          return util.pick(online, query, function(env) {
            return env.name;
          }, "computer");
        }
        async function threadsOn(link) {
          var listed = await link.request("thread/list", { limit: 50, sortKey: "updated_at", archived: false });
          return (listed && listed.data || []).filter(function(thread) {
            return !thread.ephemeral;
          });
        }
        async function chats() {
          var account = await auth.current();
          var session = await current(account);
          var all = await environments(account, session);
          var online = all.filter(function(env) {
            return env.online;
          });
          if (!online.length) pickComputer(all);
          var found = [];
          var unpaired = null;
          var reached = false;
          for (var i = 0; i < online.length; i++) {
            var link = open(account, session, online[i].id);
            try {
              await link.start();
              reached = true;
              (await threadsOn(link)).slice(0, 20).forEach(function(thread) {
                var state = thread.status && thread.status.type;
                found.push({
                  kind: "session",
                  id: thread.id,
                  computer: online[i].name,
                  label: threadLabel(thread).slice(0, 80),
                  state: state === "active" ? "working" : state === "idle" ? "open" : "not open",
                  updatedAt: util.toMillis(thread.recencyAt || thread.updatedAt)
                });
              });
            } catch (error) {
              if (!error.unpaired) throw error;
              unpaired = error;
            } finally {
              link.close();
            }
          }
          if (!reached && unpaired) throw unpaired;
          if (reached && !session.paired) await markPaired(session);
          return found;
        }
        async function send(args) {
          var text = args && args.message;
          if (typeof text !== "string" || !text.trim() || text.length > 16e3) {
            throw PluginError("INVALID_ARGS", "Provide a message between 1 and 16,000 characters.");
          }
          var account = await auth.current();
          var session = await current(account);
          var computer = pickComputer(await environments(account, session), args.computer);
          var link = open(account, session, computer.id);
          try {
            await link.start();
            var threads = await threadsOn(link);
            if (!args.session) {
              var loaded = threads.filter(function(thread2) {
                return thread2.status && thread2.status.type !== "notLoaded";
              });
              if (loaded.length) threads = loaded;
            }
            var thread = util.pick(threads, args.session, threadLabel, "Codex session on " + computer.name);
            await link.request("thread/queue/add", {
              threadId: thread.id,
              input: [{ type: "text", text, textElements: [] }],
              clientUserMessageId: util.uuid()
            });
            var label = '"' + threadLabel(thread).slice(0, 60) + '" on ' + computer.name;
            var state = thread.status && thread.status.type;
            if (state === "idle") return { text: "Sent to Codex session " + label + "." };
            if (state === "active") return { text: "Queued for Codex session " + label + "; it runs after the current turn." };
            return { text: "Queued for Codex session " + label + "; it runs when the session is next opened." };
          } finally {
            link.close();
          }
        }
        async function markPaired(session) {
          session.paired = true;
          await storage.setItem(KEY, JSON.stringify(session));
        }
        async function pair(input) {
          var text = typeof input === "string" ? input.trim() : "";
          var fromLink = text.match(/[?&#](?:manual_pairing_code|pairing_code|code)=([^&#]+)/i);
          var code = fromLink ? decodeURIComponent(fromLink[1]) : text;
          if (!code || code.length > 512 || /\s/.test(code)) {
            throw PluginError("INVALID_ARGS", "Paste the pairing code your computer shows.");
          }
          var manual = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(code);
          var account = await auth.current();
          var session = await current(account);
          var body = { client_id: session.clientId };
          body[manual ? "manual_pairing_code" : "pairing_code"] = manual ? code.toUpperCase() : code;
          try {
            await call(account, "POST", "/client/pair", body, session.clientId);
          } catch (error) {
            if (/HTTP 4\d\d/.test(error.message)) {
              throw PluginError("INVALID_ARGS", "That pairing code did not work. Codes expire after a few minutes; get a new one.");
            }
            throw error;
          }
          await markPaired(session);
          return environments(account, session);
        }
        async function disconnect() {
          await storage.removeItem(KEY);
        }
        return { load, enroll, computers, chats, pair, send, disconnect };
      }
      module.exports = { createCodexRemote };
    }
  });

  // src/codex-cloud.js
  var require_codex_cloud = __commonJS({
    "src/codex-cloud.js"(exports, module) {
      "use strict";
      var util = require_util();
      var codexHeaders = require_codex_auth().codexHeaders;
      var PluginError = util.PluginError;
      var API = "https://chatgpt.com/backend-api/wham";
      function prompt(text) {
        return [{ type: "message", role: "user", content: [{ content_type: "text", text }] }];
      }
      function checkText(text) {
        if (typeof text !== "string" || !text.trim() || text.length > 16e3) {
          throw PluginError("INVALID_ARGS", "Provide a message between 1 and 16,000 characters.");
        }
      }
      function defaultBranch(env) {
        var repos = env.repo_map ? Object.keys(env.repo_map).map(function(key) {
          return env.repo_map[key];
        }) : [];
        var branch = repos.length && repos[0] && repos[0].default_branch;
        return typeof branch === "string" && branch ? branch : "main";
      }
      function createCodexCloud(fetch2, auth) {
        async function call(method, path, body) {
          var account = await auth.current();
          var response = await fetch2(API + path, {
            method,
            headers: codexHeaders(account),
            body: body === void 0 ? void 0 : JSON.stringify(body)
          });
          if (response.status < 200 || response.status >= 300) {
            console.error("Codex Cloud " + method + " " + path.split("?")[0].replace(/\/tasks\/(?!list$)[^/]+/, "/tasks/:id") + ": HTTP " + response.status);
          }
          if (response.status === 401) throw PluginError("AUTH_REQUIRED", "Codex sign-in expired. Sign in to Codex again in plugin settings.");
          if (response.status === 403) throw PluginError("PERMISSION_DENIED", "Codex Cloud is not enabled for this ChatGPT account or workspace.");
          if (response.status === 404) throw PluginError("INVALID_ARGS", "Codex Cloud could not find that task.");
          if (response.status === 429) throw PluginError("RATE_LIMITED", "Codex Cloud usage limit reached. Try again later.");
          if (response.status < 200 || response.status >= 300) {
            throw PluginError("PLUGIN_UNAVAILABLE", "Codex Cloud returned an error (HTTP " + response.status + ").");
          }
          return response.json();
        }
        async function environments() {
          var list = await call("GET", "/environments");
          return (Array.isArray(list) ? list : []).map(function(env) {
            return { id: env.id, label: env.label || env.id, pinned: !!env.is_pinned, branch: defaultBranch(env) };
          }).sort(function(a, b) {
            return Number(b.pinned) - Number(a.pinned);
          });
        }
        async function tasks() {
          var body = await call("GET", "/tasks/list?limit=20&task_filter=current");
          return (body && body.items || []).filter(function(task) {
            return task && task.id && !task.archived;
          }).map(function(task) {
            var display = task.task_status_display || {};
            return {
              id: task.id,
              title: task.title || task.id,
              environment: display.environment_label || "",
              turnId: display.latest_turn_status_display && display.latest_turn_status_display.turn_id,
              updatedAt: util.toMillis(task.updated_at || task.created_at)
            };
          });
        }
        async function create(args) {
          checkText(args && args.prompt);
          var env = util.pick(await environments(), args.environment, function(e) {
            return e.label;
          }, "Codex Cloud environment");
          var body = await call("POST", "/tasks", {
            new_task: { environment_id: env.id, branch: env.branch, run_environment_in_qa_mode: false },
            input_items: prompt(args.prompt)
          });
          var id = body && (body.task && body.task.id || body.id);
          if (!id) throw PluginError("PLUGIN_UNAVAILABLE", "Codex Cloud did not confirm the task; check chatgpt.com/codex before trying again.");
          return { text: "Started a Codex Cloud task in " + env.label + "." };
        }
        async function followUp(args) {
          checkText(args && args.message);
          var task = util.pick(await tasks(), args.task, function(t) {
            return t.title;
          }, "Codex Cloud task");
          var turnId = task.turnId;
          if (!turnId) {
            var detail = await call("GET", "/tasks/" + encodeURIComponent(task.id));
            turnId = detail && detail.task && detail.task.current_turn_id;
          }
          if (!turnId) throw PluginError("PLUGIN_UNAVAILABLE", "That Codex Cloud task has no turn to follow up on yet.");
          var body = await call("POST", "/tasks", {
            follow_up: { task_id: task.id, turn_id: turnId, run_environment_in_qa_mode: false },
            input_items: prompt(args.message)
          });
          if (!body) throw PluginError("PLUGIN_UNAVAILABLE", "Codex Cloud did not confirm the follow-up; check the task before sending again.");
          return { text: 'Sent a follow-up to Codex Cloud task "' + task.title.slice(0, 60) + '".' };
        }
        return { environments, tasks, create, followUp };
      }
      module.exports = { createCodexCloud };
    }
  });

  // src/codex-chats.js
  var require_codex_chats = __commonJS({
    "src/codex-chats.js"(exports, module) {
      "use strict";
      var util = require_util();
      var PluginError = util.PluginError;
      var PREFS_KEY = "chatgpt.codex.chats.v1";
      var CACHE_KEY = "chatgpt.codex.chats.cache.v1";
      var MAX_NICKNAME = 40;
      function keyOf(chat) {
        return chat.kind + ":" + chat.id;
      }
      function accountKey(a) {
        return a ? a.account + ":" + a.user : null;
      }
      function sameAccount(a, b) {
        return !!a && !!b && a.account === b.account && a.user === b.user;
      }
      function createCodexChats(storage, remote, cloud, chatgpt, auth, now) {
        var started = 0;
        var landed = 0;
        async function stored() {
          var raw = await storage.getItem(PREFS_KEY);
          return raw ? JSON.parse(raw) : {};
        }
        async function prefs() {
          var saved = await stored();
          var key = accountKey(await auth.load());
          if (key && !saved.accounts && (saved.defaultChat || saved.nicknames)) {
            var accounts = {};
            accounts[key] = { defaultChat: saved.defaultChat || null, nicknames: saved.nicknames || {} };
            saved = { destination: saved.destination || null, accounts };
            try {
              await storage.setItem(PREFS_KEY, JSON.stringify(saved));
            } catch (_) {
            }
          }
          var mine = key && saved.accounts && saved.accounts[key] || {};
          return { defaultChat: mine.defaultChat || null, nicknames: mine.nicknames || {}, destination: saved.destination || null };
        }
        async function savePrefs(value) {
          var saved = await stored();
          var key = accountKey(await auth.load());
          var next = Object.assign({}, saved, { destination: value.destination || null });
          if (key) {
            next.accounts = Object.assign({}, saved.accounts);
            next.accounts[key] = { defaultChat: value.defaultChat || null, nicknames: value.nicknames };
            delete next.defaultChat;
            delete next.nicknames;
          }
          return storage.setItem(PREFS_KEY, JSON.stringify(next));
        }
        async function named(chats) {
          var saved = await prefs();
          var defaultKey = saved.defaultChat && keyOf(saved.defaultChat);
          chats.forEach(function(chat) {
            var nick = saved.nicknames[keyOf(chat)];
            chat.nickname = nick ? nick.nickname : "";
            chat.isDefault = keyOf(chat) === defaultKey;
          });
          return chats.sort(function(a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
          });
        }
        async function cached() {
          try {
            var raw = await storage.getItem(CACHE_KEY);
            var entry = raw ? JSON.parse(raw) : null;
            if (!entry || !sameAccount(entry, await auth.load())) return null;
            return { chats: await named(entry.chats), at: entry.at };
          } catch (_) {
            return null;
          }
        }
        async function remember(owner, seq, chats) {
          try {
            if (seq <= landed || !sameAccount(owner, await auth.load())) return;
            landed = seq;
            await storage.setItem(CACHE_KEY, JSON.stringify({ account: owner.account, user: owner.user, at: now(), chats }));
          } catch (_) {
          }
        }
        async function list() {
          var seq = ++started;
          var owner = null;
          try {
            owner = await auth.load();
          } catch (_) {
          }
          var errors = [];
          function part(name, promise) {
            return promise.catch(function(error) {
              console.error("Listing Codex " + name + " chats failed: " + (error && error.code || error && error.name || error));
              errors.push({ part: name, error });
              return [];
            });
          }
          var halves = await Promise.all([
            part("computers", remote.chats()),
            part("cloud", cloud.tasks().then(function(tasks) {
              return tasks.map(function(task) {
                return { kind: "task", id: task.id, label: task.title.slice(0, 80), state: "cloud", updatedAt: task.updatedAt };
              });
            })),
            part("chatgpt", chatgpt.list())
          ]);
          var chats = halves[0].concat(halves[1], halves[2]);
          if (errors.length < halves.length) await remember(owner, seq, chats);
          return { chats: await named(chats), errors };
        }
        async function update(chat, nickname, makeDefault) {
          if (!chat || chat.kind !== "session" && chat.kind !== "task" && chat.kind !== "chat" || typeof chat.id !== "string" || !chat.id) {
            throw PluginError("INVALID_ARGS", "Pick a Codex chat first.");
          }
          var name = typeof nickname === "string" ? nickname.trim().slice(0, MAX_NICKNAME) : "";
          var saved = await prefs();
          var entry = { kind: chat.kind, id: chat.id, computer: chat.computer || "", label: String(chat.label || "").slice(0, 80) };
          if (nickname !== void 0) {
            Object.keys(saved.nicknames).forEach(function(key) {
              if (name && key !== keyOf(entry) && saved.nicknames[key].nickname.toLowerCase() === name.toLowerCase()) {
                delete saved.nicknames[key];
              }
            });
            if (name) saved.nicknames[keyOf(entry)] = Object.assign({ nickname: name }, entry);
            else delete saved.nicknames[keyOf(entry)];
          }
          if (makeDefault) saved.defaultChat = entry;
          await savePrefs(saved);
          return saved;
        }
        async function resolve(query) {
          var saved = await prefs();
          var wanted = typeof query === "string" ? query.trim().toLowerCase() : "";
          if (!wanted) throw PluginError("INVALID_ARGS", "Name the Codex chat.");
          var nicknamed = Object.keys(saved.nicknames).map(function(key) {
            return saved.nicknames[key];
          });
          function byId(chats) {
            return chats.filter(function(c) {
              return c.id.toLowerCase() === wanted;
            })[0];
          }
          var known = byId(nicknamed.concat((await cached() || { chats: [] }).chats));
          if (known) return known;
          var found = await list();
          var listed = byId(found.chats);
          if (listed) return listed;
          var exact = nicknamed.filter(function(n) {
            return n.nickname.toLowerCase() === wanted;
          });
          if (exact.length === 1) return exact[0];
          var partial = nicknamed.filter(function(n) {
            return n.nickname.toLowerCase().indexOf(wanted) >= 0;
          });
          if (partial.length === 1) return partial[0];
          return util.pick(found.chats, query, function(chat) {
            return chat.nickname || chat.label;
          }, "Codex chat");
        }
        async function send(args) {
          var text = args && args.message;
          if (typeof text !== "string" || !text.trim() || text.length > 16e3) {
            throw PluginError("INVALID_ARGS", "Provide a message between 1 and 16,000 characters.");
          }
          return deliver(await resolve(args.chat), text);
        }
        function deliver(chat, text) {
          if (chat.kind === "task") return cloud.followUp({ message: text, task: chat.id });
          if (chat.kind === "chat") return chatgpt.send({ message: text, conversation: chat.id, title: chat.nickname || chat.label });
          return remote.send({ message: text, session: chat.id, computer: chat.computer });
        }
        async function setDestination(value) {
          if (value !== "dot" && value !== "codex") throw PluginError("INVALID_ARGS", "Choose the Dot or the Codex default chat.");
          var saved = await prefs();
          saved.destination = value;
          await savePrefs(saved);
        }
        async function forget() {
          try {
            await storage.removeItem(CACHE_KEY);
          } catch (_) {
          }
        }
        return {
          list,
          cached,
          forget,
          update,
          resolve,
          send,
          deliver,
          setDestination,
          prefs,
          keyOf
        };
      }
      module.exports = { createCodexChats };
    }
  });

  // node_modules/@noble/hashes/sha3.js
  var sha3_exports = {};
  __export(sha3_exports, {
    Keccak: () => Keccak,
    keccakP: () => keccakP,
    keccak_224: () => keccak_224,
    keccak_256: () => keccak_256,
    keccak_384: () => keccak_384,
    keccak_512: () => keccak_512,
    sha3_224: () => sha3_224,
    sha3_256: () => sha3_256,
    sha3_384: () => sha3_384,
    sha3_512: () => sha3_512,
    shake128: () => shake128,
    shake128_32: () => shake128_32,
    shake256: () => shake256,
    shake256_64: () => shake256_64
  });
  function keccakP(s, rounds = 24) {
    if (!(s instanceof Uint32Array))
      throw new TypeError('"s" expected Uint32Array(50), got type=' + typeof s);
    if (s.length !== 50)
      throw new RangeError('"s" expected Uint32Array(50), got length=' + s.length);
    anumber(rounds, "rounds");
    if (rounds < 1 || rounds > 24)
      throw new Error('"rounds" expected integer 1..24');
    for (let round = 24 - rounds; round < 24; round++) {
      for (let x = 0; x < 10; x++)
        B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
      for (let x = 0; x < 10; x += 2) {
        const idx1 = (x + 8) % 10;
        const idx0 = (x + 2) % 10;
        const B0 = B[idx0];
        const B1 = B[idx0 + 1];
        const Th = rotlH(B0, B1, 1) ^ B[idx1];
        const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
        for (let y = 0; y < 50; y += 10) {
          s[x + y] ^= Th;
          s[x + y + 1] ^= Tl;
        }
      }
      let curH = s[2];
      let curL = s[3];
      for (let t = 0; t < 24; t++) {
        const shift = SHA3_ROTL[t];
        const Th = rotlH(curH, curL, shift);
        const Tl = rotlL(curH, curL, shift);
        const PI = SHA3_PI[t];
        curH = s[PI];
        curL = s[PI + 1];
        s[PI] = Th;
        s[PI + 1] = Tl;
      }
      for (let y = 0; y < 50; y += 10) {
        const b0 = s[y], b1 = s[y + 1], b2 = s[y + 2], b3 = s[y + 3];
        s[y] ^= ~s[y + 2] & s[y + 4];
        s[y + 1] ^= ~s[y + 3] & s[y + 5];
        s[y + 2] ^= ~s[y + 4] & s[y + 6];
        s[y + 3] ^= ~s[y + 5] & s[y + 7];
        s[y + 4] ^= ~s[y + 6] & s[y + 8];
        s[y + 5] ^= ~s[y + 7] & s[y + 9];
        s[y + 6] ^= ~s[y + 8] & b0;
        s[y + 7] ^= ~s[y + 9] & b1;
        s[y + 8] ^= ~b0 & b2;
        s[y + 9] ^= ~b1 & b3;
      }
      s[0] ^= SHA3_IOTA_H[round];
      s[1] ^= SHA3_IOTA_L[round];
    }
    clean(B);
  }
  var _0n7, _1n6, _2n4, _7n2, _256n, _0x71n, SHA3_PI, SHA3_ROTL, _SHA3_IOTA, IOTAS, SHA3_IOTA_H, SHA3_IOTA_L, rotlSH, rotlSL, rotlBH, rotlBL, rotlH, rotlL, B, Keccak, genKeccak, sha3_224, sha3_256, sha3_384, sha3_512, keccak_224, keccak_256, keccak_384, keccak_512, genShake, shake128, shake256, shake128_32, shake256_64;
  var init_sha3 = __esm({
    "node_modules/@noble/hashes/sha3.js"() {
      init_u64();
      init_utils();
      _0n7 = BigInt(0);
      _1n6 = BigInt(1);
      _2n4 = BigInt(2);
      _7n2 = BigInt(7);
      _256n = BigInt(256);
      _0x71n = BigInt(113);
      SHA3_PI = [];
      SHA3_ROTL = [];
      _SHA3_IOTA = [];
      for (let round = 0, R = _1n6, x = 1, y = 0; round < 24; round++) {
        [x, y] = [y, (2 * x + 3 * y) % 5];
        SHA3_PI.push(2 * (5 * y + x));
        SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
        let t = _0n7;
        for (let j = 0; j < 7; j++) {
          R = (R << _1n6 ^ (R >> _7n2) * _0x71n) % _256n;
          if (R & _2n4)
            t ^= _1n6 << (_1n6 << BigInt(j)) - _1n6;
        }
        _SHA3_IOTA.push(t);
      }
      IOTAS = split(_SHA3_IOTA, true);
      SHA3_IOTA_H = IOTAS[0];
      SHA3_IOTA_L = IOTAS[1];
      rotlSH = (h, l, s) => h << s | l >>> 32 - s;
      rotlSL = (h, l, s) => l << s | h >>> 32 - s;
      rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
      rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;
      rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
      rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
      B = new Uint32Array(5 * 2);
      Keccak = class _Keccak {
        // NOTE: we accept arguments in bytes instead of bits here.
        constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
          __publicField(this, "state");
          __publicField(this, "pos", 0);
          __publicField(this, "posOut", 0);
          __publicField(this, "finished", false);
          __publicField(this, "state32");
          __publicField(this, "destroyed", false);
          __publicField(this, "blockLen");
          __publicField(this, "suffix");
          __publicField(this, "outputLen");
          __publicField(this, "canXOF");
          __publicField(this, "enableXOF", false);
          __publicField(this, "rounds");
          anumber(blockLen, "blockLen");
          anumber(suffix, "suffix");
          anumber(rounds, "rounds");
          abool(enableXOF, "enableXOF");
          this.blockLen = blockLen;
          this.suffix = suffix;
          this.outputLen = outputLen;
          this.enableXOF = enableXOF;
          this.canXOF = enableXOF;
          this.rounds = rounds;
          anumber(outputLen, "outputLen");
          if (!(0 < blockLen && blockLen < 200))
            throw new Error('"blockLen" must be 1..199');
          this.state = new Uint8Array(200);
          this.state32 = u32(this.state);
        }
        clone() {
          return this._cloneInto();
        }
        keccak() {
          swap32IfBE(this.state32);
          keccakP(this.state32, this.rounds);
          swap32IfBE(this.state32);
          this.posOut = 0;
          this.pos = 0;
        }
        update(data) {
          aexists(this);
          abytes(data);
          const { blockLen, state, state32 } = this;
          const len = data.length;
          const canUseU32 = blockLen % 4 === 0 && data.byteOffset % 4 === 0;
          const blockLen32 = blockLen / 4;
          const data32 = canUseU32 && len >= blockLen ? u32(data) : void 0;
          for (let pos = 0; pos < len; ) {
            if (data32 !== void 0 && this.pos === 0 && pos % 4 === 0 && len - pos >= blockLen) {
              for (let i = 0, o = pos / 4; i < blockLen32; i++)
                state32[i] ^= data32[o + i];
              pos += blockLen;
              this.pos = blockLen;
              this.keccak();
              continue;
            }
            const take = Math.min(blockLen - this.pos, len - pos);
            for (let i = 0; i < take; i++)
              state[this.pos++] ^= data[pos++];
            if (this.pos === blockLen)
              this.keccak();
          }
          return this;
        }
        finish() {
          if (this.finished)
            return;
          this.finished = true;
          const { state, suffix, pos, blockLen } = this;
          state[pos] ^= suffix;
          if ((suffix & 128) !== 0 && pos === blockLen - 1)
            this.keccak();
          state[blockLen - 1] ^= 128;
          this.keccak();
        }
        writeInto(out) {
          aexists(this, false);
          abytes(out);
          this.finish();
          const bufferOut = this.state;
          const { blockLen } = this;
          for (let pos = 0, len = out.length; pos < len; ) {
            if (this.posOut >= blockLen)
              this.keccak();
            const take = Math.min(blockLen - this.posOut, len - pos);
            out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
            this.posOut += take;
            pos += take;
          }
          return out;
        }
        xofInto(out) {
          if (!this.enableXOF)
            throw new Error("XOF is not enabled");
          return this.writeInto(out);
        }
        xof(bytes) {
          anumber(bytes);
          return this.xofInto(new Uint8Array(bytes));
        }
        digestInto(out) {
          aoutput(out, this);
          if (this.finished)
            throw new Error("digest() was already called");
          this.writeInto(out.length === this.outputLen ? out : out.subarray(0, this.outputLen));
          this.destroy();
        }
        digest() {
          const out = new Uint8Array(this.outputLen);
          this.digestInto(out);
          return out;
        }
        destroy() {
          this.destroyed = true;
          clean(this.state);
        }
        _cloneInto(to) {
          const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
          to || (to = new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
          to.blockLen = blockLen;
          to.state32.set(this.state32);
          to.pos = this.pos;
          to.posOut = this.posOut;
          to.finished = this.finished;
          to.rounds = rounds;
          to.suffix = suffix;
          to.outputLen = outputLen;
          to.enableXOF = enableXOF;
          to.canXOF = this.canXOF;
          to.destroyed = this.destroyed;
          return to;
        }
      };
      genKeccak = (suffix, blockLen, outputLen, info = {}) => createHasher(() => new Keccak(blockLen, suffix, outputLen), info);
      sha3_224 = /* @__PURE__ */ genKeccak(
        6,
        144,
        28,
        /* @__PURE__ */ oidNist(7)
      );
      sha3_256 = /* @__PURE__ */ genKeccak(
        6,
        136,
        32,
        /* @__PURE__ */ oidNist(8)
      );
      sha3_384 = /* @__PURE__ */ genKeccak(
        6,
        104,
        48,
        /* @__PURE__ */ oidNist(9)
      );
      sha3_512 = /* @__PURE__ */ genKeccak(
        6,
        72,
        64,
        /* @__PURE__ */ oidNist(10)
      );
      keccak_224 = /* @__PURE__ */ genKeccak(1, 144, 28);
      keccak_256 = /* @__PURE__ */ genKeccak(1, 136, 32);
      keccak_384 = /* @__PURE__ */ genKeccak(1, 104, 48);
      keccak_512 = /* @__PURE__ */ genKeccak(1, 72, 64);
      genShake = (suffix, blockLen, outputLen, info = {}) => createHasher((opts = {}) => {
        opts = checkOpts({}, opts);
        return new Keccak(blockLen, suffix, opts.dkLen === void 0 ? outputLen : opts.dkLen, true);
      }, info);
      shake128 = /* @__PURE__ */ genShake(31, 168, 16, /* @__PURE__ */ oidNist(11));
      shake256 = /* @__PURE__ */ genShake(31, 136, 32, /* @__PURE__ */ oidNist(12));
      shake128_32 = /* @__PURE__ */ genShake(31, 168, 32, /* @__PURE__ */ oidNist(11));
      shake256_64 = /* @__PURE__ */ genShake(31, 136, 64, /* @__PURE__ */ oidNist(12));
    }
  });

  // src/chatgpt-chats.js
  var require_chatgpt_chats = __commonJS({
    "src/chatgpt-chats.js"(exports, module) {
      "use strict";
      var sha3_5122 = (init_sha3(), __toCommonJS(sha3_exports)).sha3_512;
      var util = require_util();
      var PluginError = util.PluginError;
      var API = "https://chatgpt.com/backend-api";
      var DEVICE_KEY = "chatgpt.web.device.v1";
      var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
      var DATA_BUILD = "prod-329d9af90bc80a50b17d4b6f95c261f7c70f5a9b";
      var POW_BUDGET_MS = 5e3;
      var MAX_REPLY = 300;
      function needsBrowser() {
        return PluginError("PERMISSION_DENIED", "ChatGPT wants a browser check before taking this message. Send it from the ChatGPT app.");
      }
      function checkText(text) {
        if (typeof text !== "string" || !text.trim() || text.length > 16e3) {
          throw PluginError("INVALID_ARGS", "Provide a message between 1 and 16,000 characters.");
        }
      }
      function failure(status) {
        if (status === 401) return PluginError("AUTH_REQUIRED", "ChatGPT sign-in expired. Sign in again in plugin settings.");
        if (status === 403) return PluginError("PERMISSION_DENIED", "ChatGPT blocked this message from the plugin. Send it from the ChatGPT app.");
        if (status === 404) return PluginError("INVALID_ARGS", "ChatGPT could not find that chat.");
        if (status === 429) return PluginError("RATE_LIMITED", "ChatGPT usage limit reached. Try again later.");
        return PluginError("PLUGIN_UNAVAILABLE", "ChatGPT returned an error (HTTP " + status + "). If sending, check the chat before trying again.");
      }
      function browserConfig(now) {
        return [
          4e3,
          new Date(now()).toString(),
          null,
          0,
          USER_AGENT,
          null,
          DATA_BUILD,
          "en-US",
          "en-US,en",
          0,
          "webdriver−false",
          "location",
          "ontransitionend",
          Math.random() * 1e3,
          util.uuid(),
          "",
          8,
          Math.floor(now() / 1e3)
        ];
      }
      function solve(seed, difficulty, config, now) {
        var target = difficulty.toLowerCase();
        var deadline = now() + POW_BUDGET_MS;
        for (var i = 0; ; i++) {
          if (i % 1e3 === 999 && now() > deadline) return null;
          config[3] = i;
          config[9] = i >> 1;
          var answer = util.base64(util.utf8(JSON.stringify(config)));
          var hash = sha3_5122(util.utf8(seed + answer));
          var hex = "";
          for (var j = 0; hex.length < target.length; j++) hex += ("0" + hash[j].toString(16)).slice(-2);
          if (hex.slice(0, target.length) <= target) return answer;
        }
      }
      function parseStream(body) {
        var result = { conversation: null, reply: "", done: false, error: false };
        var current = null;
        var path = null;
        var op = null;
        function start(event) {
          var m = event.message;
          if (event.conversation_id) result.conversation = event.conversation_id;
          var parts = m.content && m.content.parts;
          current = m.author && m.author.role === "assistant" && m.recipient === "all" && parts && m.content.content_type === "text" ? { text: parts && typeof parts[0] === "string" ? parts[0] : "" } : null;
          if (current) result.last = current;
        }
        function apply(p, o, v) {
          if (p === "" && o === "add" && v && typeof v.message === "object") start(v);
          else if (current && p === "/message/content/parts/0" && typeof v === "string") current.text = o === "append" ? current.text + v : v;
        }
        body.split("\n").forEach(function(line) {
          if (line.trim() === "data: [DONE]") result.done = true;
          if (line.indexOf("data: ") !== 0) return;
          var event;
          try {
            event = JSON.parse(line.slice(6));
          } catch (_) {
            return;
          }
          if (!event || typeof event !== "object") return;
          if (event.conversation_id && !result.conversation) result.conversation = event.conversation_id;
          if (event.type === "message_stream_complete") result.done = true;
          if (event.error) result.error = true;
          if (event.message && typeof event.message === "object") return start(event);
          if (!("v" in event)) return;
          if ("p" in event) path = event.p;
          if ("o" in event) op = event.o;
          if (Array.isArray(event.v)) event.v.forEach(function(d) {
            if (d) apply(d.p, d.o, d.v);
          });
          else apply(path, op, event.v);
        });
        result.reply = result.last ? result.last.text.trim() : "";
        delete result.last;
        return result;
      }
      function millis(value) {
        return typeof value === "string" ? Date.parse(value) || 0 : util.toMillis(value);
      }
      function createChatGptChats(storage, fetch2, now, auth) {
        async function deviceId() {
          var id = await storage.getItem(DEVICE_KEY);
          if (id) return id;
          id = util.uuid();
          await storage.setItem(DEVICE_KEY, id);
          return id;
        }
        async function call(session, method, path, body, extra) {
          var response = await fetch2(API + path, {
            method,
            headers: Object.assign({
              "Authorization": "Bearer " + session.account.accessToken,
              "ChatGPT-Account-Id": session.account.account,
              "oai-device-id": session.device,
              "oai-language": "en-US",
              "User-Agent": USER_AGENT,
              "Origin": "https://chatgpt.com",
              "Referer": "https://chatgpt.com/",
              "Content-Type": "application/json"
            }, extra),
            body: body === void 0 ? void 0 : JSON.stringify(body)
          });
          if (response.status < 200 || response.status >= 300) {
            console.error("ChatGPT " + method + " " + path.split("?")[0].replace(/\/conversation\/[^/]+$/, "/conversation/:id") + ": HTTP " + response.status);
            throw failure(response.status);
          }
          return response;
        }
        async function signedIn() {
          return { account: await auth.current(), device: await deviceId() };
        }
        async function list() {
          var session = await signedIn();
          var body = await (await call(session, "GET", "/conversations?offset=0&limit=20&order=updated")).json();
          return (body && body.items || []).filter(function(c) {
            return c && c.id && !c.is_archived;
          }).map(function(c) {
            return { kind: "chat", id: c.id, label: String(c.title || "New chat").slice(0, 80), state: "chatgpt", updatedAt: millis(c.update_time || c.create_time) };
          });
        }
        async function sentinel(session) {
          var config = browserConfig(now);
          var p = solve(String(Math.random()), "0fffff", config, now);
          if (!p) throw needsBrowser();
          var req = await (await call(session, "POST", "/sentinel/chat-requirements", { p: "gAAAAAC" + p })).json();
          if (!req || !req.token) throw PluginError("PLUGIN_UNAVAILABLE", "ChatGPT did not accept a new message. Try again later.");
          console.log("ChatGPT chat requirements: proof of work " + !!(req.proofofwork && req.proofofwork.required) + ", turnstile " + !!(req.turnstile && req.turnstile.required) + ", arkose " + !!(req.arkose && req.arkose.required));
          if (req.arkose && req.arkose.required) throw needsBrowser();
          var headers = { "openai-sentinel-chat-requirements-token": req.token };
          var pow2 = req.proofofwork;
          if (pow2 && pow2.required) {
            var answer = typeof pow2.seed === "string" && typeof pow2.difficulty === "string" && solve(pow2.seed, pow2.difficulty, config, now);
            if (!answer) throw needsBrowser();
            headers["openai-sentinel-proof-token"] = "gAAAAAB" + answer;
          }
          return headers;
        }
        async function send(args) {
          checkText(args && args.message);
          var session = await signedIn();
          var id = args.conversation;
          var parent = "client-created-root";
          if (id) {
            var detail = await (await call(session, "GET", "/conversation/" + encodeURIComponent(id))).json();
            parent = detail && detail.current_node;
            if (!parent) throw PluginError("PLUGIN_UNAVAILABLE", "ChatGPT returned an incomplete chat.");
          }
          var headers = await sentinel(session);
          var turn = {
            action: "next",
            parent_message_id: parent,
            model: "auto",
            conversation_mode: { kind: "primary_assistant" },
            supports_buffering: true,
            supported_encodings: ["v1"]
          };
          if (id) turn.conversation_id = id;
          var prepared = await (await call(session, "POST", "/f/conversation/prepare", Object.assign({ client_prepare_state: "none" }, turn))).json();
          if (!prepared || !prepared.conduit_token) throw PluginError("PLUGIN_UNAVAILABLE", "ChatGPT did not accept a new message. Try again later.");
          headers["x-conduit-token"] = prepared.conduit_token;
          headers["Accept"] = "text/event-stream";
          var message = {
            id: util.uuid(),
            author: { role: "user" },
            create_time: now() / 1e3,
            content: { content_type: "text", parts: [args.message] },
            metadata: {}
          };
          var response = await call(session, "POST", "/f/conversation", Object.assign({ messages: [message], client_prepare_state: "success" }, turn), headers);
          var stream = parseStream(await response.text());
          if (!stream.conversation || stream.error && !stream.reply) {
            throw PluginError("PLUGIN_UNAVAILABLE", "ChatGPT did not confirm the message; check the chat before sending again.");
          }
          var text = id ? 'Sent to ChatGPT chat "' + String(args.title || id).slice(0, 60) + '".' : "Started a new ChatGPT chat (chat_id " + stream.conversation + ").";
          if (stream.done && stream.reply) {
            text += " ChatGPT replied: " + (stream.reply.length > MAX_REPLY ? stream.reply.slice(0, MAX_REPLY - 1) + "…" : stream.reply);
          }
          return { text };
        }
        return { list, send };
      }
      module.exports = { createChatGptChats };
    }
  });

  // src/reach.js
  var require_reach = __commonJS({
    "src/reach.js"(exports, module) {
      "use strict";
      var HOSTS = ["chatgpt.com", "auth.openai.com"];
      var PROBES = [["chatgpt.com", "https://chatgpt.com/"]];
      var LAST_KEY = "chatgpt.blocked.v1";
      function unreachableHost(request) {
        return new Promise(function(resolve) {
          var answered = 0;
          PROBES.forEach(function(probe) {
            Promise.resolve().then(function() {
              return request(probe[1]);
            }).then(function() {
              if (++answered === PROBES.length) resolve(null);
            }, function() {
              resolve(probe[0]);
            });
          });
        });
      }
      async function blockedHost(request, query) {
        if (query === void 0) query = typeof Pebble !== "undefined" && Pebble.permissions || null;
        if (query) {
          for (var host of HOSTS) {
            if (await query.query("Internet/" + host) !== "granted") return { host, sure: true };
          }
          return null;
        }
        var unreachable = await unreachableHost(request);
        return unreachable && { host: unreachable, sure: false };
      }
      async function checkReach(storage, request, query) {
        var blocked = await blockedHost(request, query);
        try {
          if (blocked) storage.setItem(LAST_KEY, JSON.stringify(blocked));
          else storage.removeItem(LAST_KEY);
        } catch (e) {
        }
        return blocked;
      }
      function lastBlocked(storage) {
        try {
          return JSON.parse(storage.getItem(LAST_KEY)) || null;
        } catch (e) {
          return null;
        }
      }
      function notAllowedHost(error) {
        var match = error && error.name === "NotAllowedError" && /^fetch not allowed: https?:\/\/([^/?#:\s]+)/i.exec(String(error.message));
        if (!match) return null;
        var hostname = match[1].toLowerCase();
        for (var host of HOSTS) {
          if (hostname === host || hostname.endsWith("." + host)) return { host, sure: true };
        }
        return null;
      }
      function blockedMessage(blocked) {
        var host = blocked.host;
        return "ChatGPT doesn't have permission to connect to " + host + '. Turn on "Connect to ' + host + `" in ChatGPT's Permissions` + (blocked.sure ? "." : ", or check your internet connection.");
      }
      module.exports = {
        HOSTS,
        PROBES,
        blockedHost,
        checkReach,
        lastBlocked,
        notAllowedHost,
        blockedMessage
      };
    }
  });

  // src/plugin-entry.js
  var require_plugin_entry = __commonJS({
    "src/plugin-entry.js"(exports, module) {
      require_text_encoder();
      var PluginError = require_util().PluginError;
      var createDotsService = require_dots().createDotsService;
      var createCodexAuth = require_codex_auth().createCodexAuth;
      var createCodexRemote = require_codex_remote().createCodexRemote;
      var createCodexCloud = require_codex_cloud().createCodexCloud;
      var createCodexChats = require_codex_chats().createCodexChats;
      var createChatGptChats = require_chatgpt_chats().createChatGptChats;
      var reach = require_reach();
      var DOT_ID = "dot";
      var NEW_CHAT_ID = "new-chat";
      var NEW_CHAT_NAME = "New ChatGPT chat";
      var CHATS_FRESH_MS = 5 * 60 * 1e3;
      var PART_LABELS = { computers: "Computers: ", cloud: "Codex Cloud: ", chatgpt: "ChatGPT chats: " };
      function chatInstance(id, name, title) {
        return { instanceId: id, properties: { name: { shortText: { text: name } }, title: { shortText: { text: title } } } };
      }
      function createPlugin(storage, fetch2, now, WebSocketImpl) {
        var auth = createCodexAuth(storage, fetch2, now);
        var dots = createDotsService(storage, fetch2, auth);
        var remote = createCodexRemote(storage, fetch2, now, WebSocketImpl, auth);
        var cloud = createCodexCloud(fetch2, auth);
        var chatgpt = createChatGptChats(storage, fetch2, now, auth);
        var chats = createCodexChats(storage, remote, cloud, chatgpt, auth, now);
        async function codexStatus() {
          var account = await auth.load();
          var connected = await remote.load();
          var saved = await chats.prefs();
          var chosen = saved.defaultChat;
          var nick = chosen && saved.nicknames[chats.keyOf(chosen)];
          return {
            signedIn: !!account,
            email: account ? account.email : "",
            remoteControl: !!connected,
            paired: !!(connected && connected.paired),
            defaultChat: chosen ? Object.assign({}, chosen, { nickname: nick ? nick.nickname : "" }) : null
          };
        }
        async function destination() {
          var dot = await dots.status();
          var saved = await chats.prefs();
          var account = await auth.load();
          var codex = account && saved.defaultChat;
          var dotTarget = dot.configured ? { kind: "dot", name: dot.dotName } : null;
          var nick = codex && saved.nicknames[chats.keyOf(codex)];
          var codexTarget = codex ? { kind: "codex", chat: codex, name: nick ? nick.nickname : codex.label } : null;
          var target = saved.destination === "codex" ? codexTarget || dotTarget : dotTarget || codexTarget;
          return {
            target,
            // What settings show as picked: the saved choice, else the one a send would use.
            chosen: saved.destination || (dot.configured || !account ? "dot" : "codex"),
            choosable: !!(dotTarget && codexTarget),
            hint: target ? "Connected" : account ? "Choose a Codex chat in settings" : "Sign in in settings"
          };
        }
        async function status() {
          var where = await destination();
          return {
            dots: await dots.status(),
            codex: await codexStatus(),
            destination: { kind: where.target ? where.target.kind : null, chosen: where.chosen, choosable: where.choosable }
          };
        }
        async function connect(sessionToken) {
          return signIn(function() {
            return auth.connect(sessionToken);
          });
        }
        async function signIn(signInWith) {
          var before = await auth.load();
          var after = await signInWith();
          if (!before || before.account !== after.account || before.user !== after.user) {
            await remote.disconnect();
            await dots.disconnect();
            await chats.forget();
          }
          try {
            await dots.connect();
            return status();
          } catch (error) {
            if (error.code === "AUTH_REQUIRED") throw error;
            return Object.assign(await status(), { dotError: safeError(error).message });
          }
        }
        async function config(message) {
          switch (message && message.type) {
            case "status":
              return status();
            case "connect":
            case "dots_connect":
            case "codex_connect":
              return connect(message.session_token);
            case "device_begin":
              return auth.beginDevice();
            case "device_poll": {
              var ready = await auth.pollDevice();
              return ready ? signIn(function() {
                return auth.adopt(ready);
              }) : { pending: true };
            }
            case "codex_enroll_begin":
              return auth.beginEnroll(message.entropy);
            case "codex_enroll_finish": {
              var finished = await auth.finishEnroll(message.url);
              await remote.enroll(finished.stepUpToken, finished.seed);
              return status();
            }
            case "codex_chats": {
              var found = await chats.list();
              return {
                chats: found.chats,
                errors: found.errors.map(function(e) {
                  return PART_LABELS[e.part] + safeError(e.error).message;
                })
              };
            }
            case "codex_chat_save":
              await chats.update(message.chat, message.nickname, !!message.makeDefault);
              return { ok: true };
            case "codex_default":
              await chats.update(message.chat, void 0, true);
              return status();
            case "destination":
              await chats.setDestination(message.destination);
              return status();
            case "codex_pair":
              return { computers: await remote.pair(message.code) };
            case "codex_computers":
              return { computers: await remote.computers() };
            case "disconnect":
            case "dots_disconnect":
            case "codex_disconnect":
              await remote.disconnect();
              await dots.disconnect();
              await auth.signOut();
              await chats.forget();
              return status();
            default:
              throw PluginError("INVALID_ARGS", "Unknown settings request.");
          }
        }
        var actions = {
          send_to_agent: sendToAgent,
          start_codex_cloud_task: cloud.create
        };
        async function sendToAgent(args) {
          var text = args.message;
          if (typeof text !== "string" || !text.trim() || text.length > 16e3) {
            throw PluginError("INVALID_ARGS", "Provide a message between 1 and 16,000 characters.");
          }
          if (args.chat_id !== void 0 && args.chat_id !== null && typeof args.chat_id !== "string") {
            throw PluginError("INVALID_ARGS", "Name a ChatGPT chat.");
          }
          text += " ⌚";
          var wanted = (args.chat_id || "").trim().toLowerCase();
          if (!wanted) {
            var target = (await destination()).target;
            if (!target) {
              throw PluginError("INVALID_ARGS", "Nowhere to send yet. Sign in with ChatGPT, then set up a Dot or pick a default chat, in plugin settings.");
            }
            return target.kind === "dot" ? dots.send({ message: text }) : chats.deliver(target.chat, text);
          }
          var dot = await dots.status();
          if (wanted === DOT_ID || dot.configured && wanted === dot.dotName.toLowerCase()) {
            return dots.send({ message: text });
          }
          if (wanted === NEW_CHAT_ID || wanted === NEW_CHAT_NAME.toLowerCase()) return chatgpt.send({ message: text });
          return chats.send({ message: text, chat: args.chat_id });
        }
        async function action(request) {
          var handler = request && actions[request.action];
          if (!handler) {
            console.error("Unsupported action: " + (request && request.action));
            throw PluginError("INVALID_ARGS", "Unknown action.");
          }
          return handler(request.args || {});
        }
        async function source(request) {
          if (!request || request.category !== "agent") {
            console.error("Unsupported source: " + (request && request.category));
            throw PluginError("INVALID_ARGS", "Unsupported ChatGPT source.");
          }
          if (request.item === "configured") {
            var where = await destination();
            return { validUntilMs: now() + 60 * 1e3, instances: [{ instanceId: "chatgpt", properties: {
              name: { shortText: { text: where.target ? where.target.name : "" } },
              configured: { boolean: { value: !!where.target }, shortText: { text: where.hint } }
            } }] };
          }
          var dot = await dots.status();
          if (request.item !== "chats") {
            console.error("Unsupported source: agent/" + request.item);
            throw PluginError("INVALID_ARGS", "Unsupported ChatGPT source.");
          }
          var instances = dot.configured ? [chatInstance(DOT_ID, dot.dotName, dot.dotName)] : [];
          if (await auth.load()) instances.push(chatInstance(NEW_CHAT_ID, NEW_CHAT_NAME, NEW_CHAT_NAME));
          (await codexChats()).forEach(function(chat) {
            instances.push(chatInstance(chat.id, chat.nickname || chat.label, chat.label));
          });
          return { validUntilMs: now() + 900 * 1e3, instances };
        }
        async function codexChats() {
          var cache = await chats.cached();
          if (cache && now() - cache.at < CHATS_FRESH_MS) return cache.chats;
          var stale = cache ? cache.chats : [];
          try {
            var fresh = await chats.list();
            return fresh.errors.length < 2 ? fresh.chats : stale;
          } catch (_) {
            return stale;
          }
        }
        return { config, action, source };
      }
      function safeError(error) {
        console.error("ChatGPT request failed: " + (error && error.code || error && error.name || error));
        if (error && error.code) return { code: error.code, message: error.message };
        return {
          code: "PLUGIN_UNAVAILABLE",
          message: "Could not reach ChatGPT. If sending, delivery may be uncertain; check before trying again."
        };
      }
      function withBlockedHost(error, safe, storage, request) {
        if (error && error.code) return safe;
        var blocked = reach.notAllowedHost(error);
        try {
          if (!blocked) blocked = reach.lastBlocked(storage);
          reach.checkReach(storage, request).catch(function() {
          });
        } catch (_) {
        }
        return blocked ? { code: safe.code, message: reach.blockedMessage(blocked) + " If sending, delivery may be uncertain; check before trying again." } : safe;
      }
      if (typeof Pebble !== "undefined") {
        plugin = createPlugin(Pebble.secureStorage, fetch, Date.now, WebSocket);
        Pebble.registerActionHandler(function(request, response) {
          plugin.action(request).then(response.ok, function(error) {
            var safe = safeError(error);
            try {
              safe = withBlockedHost(error, safe, globalThis.localStorage, fetch);
            } catch (e) {
            }
            response.error(safe.code, safe.message);
          });
        });
        Pebble.registerSourceHandler(function(request, respond) {
          plugin.source(request).then(respond.data, function(error) {
            var safe = safeError(error);
            respond.error(safe.code, safe.message);
          });
        });
        Pebble.registerConfigHandler(function(message, respond) {
          if (message && message.type === "reach") {
            reach.checkReach(globalThis.localStorage, fetch).catch(function() {
              return null;
            }).then(function(blocked) {
              respond({ blocked });
            });
            return;
          }
          plugin.config(message).then(respond, function(error) {
            respond({ error: safeError(error).message });
          });
        });
      }
      var plugin;
      module.exports = { createPlugin, safeError, withBlockedHost };
    }
  });
  require_plugin_entry();
})();
/*! Bundled license information:

@noble/curves/utils.js:
@noble/curves/abstract/modular.js:
@noble/curves/abstract/curve.js:
@noble/curves/abstract/oprf.js:
@noble/curves/abstract/der.js:
@noble/curves/abstract/weierstrass.js:
@noble/curves/nist.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
