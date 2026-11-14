/**
 * BrandSentinel for Google Docs.
 * Checks the document you are writing against your brand's rules and approved facts, in a sidebar,
 * and re-checks while you write. It reads only this document, and only while the sidebar is open.
 *
 * Setup: Extensions > Apps Script, paste this file as Code.gs and Sidebar.html as an HTML file named
 * "Sidebar", save, reload the document, then use the menu BrandSentinel > Check this document.
 */

var DEFAULTS = {
  apiBase: 'https://brand-sentinel-delta.vercel.app',
  // the open demo's public token: replace it with your workspace's token (BrandSentinel > Connect)
  token: 'bs_demo_public_token',
  brand: '',
  channel: 'instagram',
  author: ''
};
var MAX_TEXT = 3000;

function onOpen() {
  DocumentApp.getUi().createMenu('BrandSentinel').addItem('Check this document', 'showSidebar').addToUi();
}

function onInstall() {
  onOpen();
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('BrandSentinel');
  DocumentApp.getUi().showSidebar(html);
}

/** The saved connection settings, with defaults for anything not set. */
function getSettings() {
  var saved = PropertiesService.getUserProperties().getProperties();
  var out = {};
  for (var key in DEFAULTS) out[key] = saved[key] ? saved[key] : DEFAULTS[key];
  return out;
}

function saveSettings(values) {
  var clean = {};
  for (var key in DEFAULTS) {
    var v = values && typeof values[key] === 'string' ? values[key].trim() : '';
    clean[key] = v.slice(0, 300);
  }
  if (clean.apiBase && !/^https:\/\//.test(clean.apiBase)) throw new Error('The server address must start with https://');
  PropertiesService.getUserProperties().setProperties(clean, true);
  return getSettings();
}

/** The text to check: the selection if there is one, otherwise the whole document (first 3,000 characters). */
function getText() {
  var doc = DocumentApp.getActiveDocument();
  var text = '';
  var selected = false;
  var selection = doc.getSelection();
  if (selection) {
    var parts = [];
    var elements = selection.getRangeElements();
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i].getElement();
      if (!el.editAsText) continue;
      var t = el.editAsText().getText();
      if (elements[i].isPartial()) t = t.substring(elements[i].getStartOffset(), elements[i].getEndOffsetInclusive() + 1);
      if (t) parts.push(t);
    }
    text = parts.join('\n');
    selected = text.replace(/\s/g, '').length > 0;
  }
  if (!selected) text = doc.getBody().getText();
  text = text.replace(/ /g, ' ').replace(/\s+$/, '');
  return { text: text.slice(0, MAX_TEXT), selected: selected, truncated: text.length > MAX_TEXT, title: doc.getName() };
}

/** One request to the BrandSentinel server. Always returns { ok: true, data } or { ok: false, error }. */
function callApi_(path, payload) {
  var s = getSettings();
  var base = s.apiBase.replace(/\/+$/, '');
  var options = { method: payload ? 'post' : 'get', headers: { Authorization: 'Bearer ' + s.token }, muteHttpExceptions: true };
  if (payload) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }
  var res;
  try {
    res = UrlFetchApp.fetch(base + path, options);
  } catch (e) {
    return { ok: false, error: "Couldn't reach BrandSentinel. Check the server address in the settings." };
  }
  var data = {};
  try {
    data = JSON.parse(res.getContentText());
  } catch (e) {
    data = {};
  }
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) return { ok: false, error: data.error || 'The server answered ' + code + '.' };
  return { ok: true, data: data };
}

/** The brands this token can check against (also tests the connection). */
function listBrands() {
  return callApi_('/api/v1/brands', null);
}

/**
 * Check the document's text. options: { ai: true } adds the AI check; { save: true } also saves the text
 * as a draft post in BrandSentinel. Returns the text that was checked, so the sidebar knows when it changed.
 */
function checkDocument(options) {
  var s = getSettings();
  var doc = getText();
  if (!doc.text.replace(/\s/g, '')) return { ok: true, empty: true, doc: doc };
  var res = callApi_('/api/v1/check', {
    text: doc.text,
    brand: s.brand || undefined,
    channel: s.channel,
    ai: !!(options && options.ai),
    save: !!(options && options.save),
    author: s.author || ''
  });
  res.doc = doc;
  return res;
}

/** Replace the first place the quoted text appears in the document (used by "Apply fix"). */
function applyFix(from, to) {
  if (!from) return false;
  var body = DocumentApp.getActiveDocument().getBody();
  var pattern = String(from).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var found = body.findText(pattern);
  if (!found) return false;
  var text = found.getElement().asText();
  var start = found.getStartOffset();
  text.deleteText(start, found.getEndOffsetInclusive());
  if (to) text.insertText(start, String(to));
  return true;
}
