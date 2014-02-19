'use strict';

var global  = require('global');
var extend  = require('extend');
var isArray = require('util').isArray;
var isDate  = require('util').isDate;
var sprintf = require('sprintf').sprintf;
var events  = require('events');

var strftime = require('./strftime');
var emitter  = new events.EventEmitter();

var translationNamespace = 'globalization';

var registry = global.__g11n = global.__g11n || {
  locale: 'en',
  namespace: null,
  translations: {},
  normalizedKeys: {}
};

function getLocale() {
  return registry.locale;
}

function setLocale(value) {
  var previousLocale = registry.locale;

  if (previousLocale != value) {
    registry.locale = value;
    emitter.emit('localechange', value, previousLocale);
  }

  return previousLocale;
}

function registerTranslations(namespace, locale, data) {
  var translations = {};

  translations[namespace] = {};
  translations[namespace][locale] = data;

  extend(true, registry.translations, translations);

  return translations;
}

function addLocaleChangeListener(callback) {
  emitter.addListener('localechange', callback);
}

function removeLocaleChangeListener(callback) {
  emitter.removeListener('localechange', callback);
}

function translate(key, options) {
  options = options || {};

  var namespace = options.namespace || registry.namespace;
  delete options.namespace;

  var locale = options.locale || registry.locale;
  delete options.locale;

  if (!isArray(key) && typeof key !== 'string' || !key.length) {
    throw new Error('invalid argument: key');
  }

  var keys = normalizeKeys(namespace, locale, key);

  var entry = keys.reduce(function(result, key) {
    if (typeof result === 'object' && result !== null && key in result) {
      return result[key];
    } else {
      return null;
    }
  }, registry.translations);

  if (entry === null) {
    if (options.fallback) {
      entry = options.fallback;
    } else {
      entry = 'missing translation: ' + keys.join('.');
    }
  }

  entry = pluralize(entry, options.count);
  entry = interpolate(entry, options);

  return entry;
}

function localize(object, options) {
  options = options || {};

  var namespace = options.namespace || translationNamespace;
  var locale    = options.locale    || registry.locale;
  var type      = options.type      || 'datetime';
  var format    = options.format    || 'default';

  if (!isDate(object)) {
    throw new Error('invalid argument: object must be a date');
  }

  format  = translate(['formats', type, format], { namespace: namespace, locale: locale });
  options = { namespace: namespace, locale: locale };

  return strftime(object, format, translate('names', options));
}

function normalizeKeys(namespace, locale, key) {
  var keys = [];

  keys = keys.concat(normalizeKey(namespace));
  keys = keys.concat(normalizeKey(locale));
  keys = keys.concat(normalizeKey(key));

  return keys;
}

function normalizeKey(key) {
  registry.normalizedKeys[key] = registry.normalizedKeys[key] || (function(key) {
    if (isArray(key)) {
      var normalizedKeyArray = key.map(function(k) { return normalizeKey(k); });

      return [].concat.apply([], normalizedKeyArray);
    } else {
      if (typeof key === 'undefined' || key === null) {
        return [];
      }

      var keys = key.split('.');

      for (var i = keys.length - 1; i >= 0; i--) {
        if (keys[i] === '') {
          keys.splice(i, 1);
        }
      }

      return keys;
    }
  })(key);

  return registry.normalizedKeys[key];
}

function pluralize(entry, count) {
  if (typeof entry !== 'object' || entry === null || typeof count !== 'number') {
    return entry;
  }

  var key;

  if (count === 0 && 'zero' in entry) {
    key = 'zero';
  }

  key = key || (count === 1 ? 'one' : 'other');

  return entry[key];
}

function interpolate(entry, values) {
  if (typeof entry !== 'string' || !Object.keys(values).length) {
    return entry;
  }

  return sprintf(entry, values);
}

function withLocale(locale, callback, context) {
  var previousLocale = registry.locale;
  registry.locale = locale;
  var result = context ? callback.call(context) : callback();
  registry.locale = previousLocale;
  return result;
}

function withNamespace(namespace, callback, context) {
  var previousNamespace = registry.namespace;
  registry.namespace = namespace;
  var result = context ? callback.call(context) : callback();
  registry.namespace = previousNamespace;
  return result;
}

registerTranslations(translationNamespace, 'en', require('./locales/en'));

var globalization = {
  setLocale: setLocale,
  getLocale: getLocale,
  translate: translate,
  localize: localize,
  withLocale: withLocale,
  withNamespace: withNamespace,
  registerTranslations: registerTranslations,
  onLocaleChange: addLocaleChangeListener,
  offLocaleChange: removeLocaleChangeListener,
  __registry: registry
};

module.exports = globalization;
module.exports.translate.registerTranslations = registerTranslations;
module.exports.translate.withNamespace = withNamespace;
