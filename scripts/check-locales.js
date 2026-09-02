const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REQUIRED_FILES = ['zotseek.ftl', 'zotseek-menu.ftl', 'zotseek.dtd', 'searchDialog.dtd'];
const CANONICAL_LOCALE = 'en-US';

function addUnique(map, key, value, source) {
  if (map.has(key)) throw new Error(`${source}: duplicate key "${key}"`);
  map.set(key, value);
}

function variablesIn(text) {
  return new Set(Array.from(text.matchAll(/\$([A-Za-z][A-Za-z0-9_-]*)/g), match => match[1]));
}

function parseFluent(source, sourceName = '<fluent>') {
  const messages = new Map();
  let current = null;
  let currentAttribute = null;
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const message = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(.*)$/);
    if (message) {
      current = { value: message[2], attributes: new Map() };
      currentAttribute = null;
      addUnique(messages, message[1], current, `${sourceName}:${index + 1}`);
      continue;
    }
    const attribute = line.match(/^\s+\.([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(.*)$/);
    if (attribute) {
      if (!current) throw new Error(`${sourceName}:${index + 1}: attribute without a message`);
      addUnique(current.attributes, attribute[1], attribute[2], `${sourceName}:${index + 1}`);
      currentAttribute = attribute[1];
      continue;
    }
    if (current && /^\s+\S/.test(line)) {
      if (currentAttribute) {
        current.attributes.set(
          currentAttribute,
          `${current.attributes.get(currentAttribute)}\n${line.trim()}`,
        );
      } else {
        current.value += `\n${line.trim()}`;
      }
    }
  }
  return messages;
}

function parseDtd(source, sourceName = '<dtd>') {
  const entities = new Map();
  for (const match of source.matchAll(/<!ENTITY\s+([A-Za-z][A-Za-z0-9._-]*)\s+(?:"([^"]*)"|'([^']*)')\s*>/g)) {
    addUnique(entities, match[1], match[2] ?? match[3], sourceName);
  }
  return entities;
}

const sorted = values => Array.from(values).sort();
const difference = (left, right) => sorted(Array.from(left).filter(value => !right.has(value)));

function compareSets(reference, candidate, description, errors) {
  const missing = difference(reference, candidate);
  const extra = difference(candidate, reference);
  if (missing.length) errors.push(`${description}: missing ${missing.join(', ')}`);
  if (extra.length) errors.push(`${description}: unexpected ${extra.join(', ')}`);
}

function compareFluent(reference, candidate, locale, fileName, errors) {
  compareSets(new Set(reference.keys()), new Set(candidate.keys()), `${locale}/${fileName} messages`, errors);
  for (const [id, expected] of reference) {
    const actual = candidate.get(id);
    if (!actual) continue;
    if (expected.value.trim() && !actual.value.trim()) {
      errors.push(`${locale}/${fileName}:${id} has an empty value`);
    }
    compareSets(new Set(expected.attributes.keys()), new Set(actual.attributes.keys()), `${locale}/${fileName}:${id} attributes`, errors);
    compareSets(variablesIn(expected.value), variablesIn(actual.value), `${locale}/${fileName}:${id} variables`, errors);
    for (const [attribute, expectedValue] of expected.attributes) {
      const actualValue = actual.attributes.get(attribute);
      if (actualValue === undefined) continue;
      if (expectedValue.trim() && !actualValue.trim()) {
        errors.push(`${locale}/${fileName}:${id}.${attribute} has an empty value`);
      }
      compareSets(variablesIn(expectedValue), variablesIn(actualValue), `${locale}/${fileName}:${id}.${attribute} variables`, errors);
    }
  }
}

function registeredLocales(bootstrapSource) {
  return new Set(Array.from(
    bootstrapSource.matchAll(/\[\s*["']locale["']\s*,\s*["']zotseek["']\s*,\s*["']([^"']+)["']/g),
    match => match[1],
  ));
}

function localeDirectories(localeRoot) {
  return new Set(fs.readdirSync(localeRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name));
}

function checkLocales(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const localeRoot = path.join(rootDir, 'locale');
  const errors = [];
  const directories = localeDirectories(localeRoot);
  const registered = registeredLocales(fs.readFileSync(path.join(rootDir, 'bootstrap.js'), 'utf8'));
  compareSets(directories, registered, 'bootstrap locale registrations', errors);
  if (!directories.has(CANONICAL_LOCALE)) errors.push(`canonical locale directory is missing: ${CANONICAL_LOCALE}`);

  for (const locale of directories) {
    for (const fileName of REQUIRED_FILES) {
      if (!fs.existsSync(path.join(localeRoot, locale, fileName))) errors.push(`${locale}: missing required file ${fileName}`);
    }
  }

  if (errors.length === 0) {
    for (const fileName of REQUIRED_FILES) {
      const canonicalPath = path.join(localeRoot, CANONICAL_LOCALE, fileName);
      const isFluent = fileName.endsWith('.ftl');
      const parse = isFluent ? parseFluent : parseDtd;
      const canonical = parse(fs.readFileSync(canonicalPath, 'utf8'), canonicalPath);
      for (const locale of directories) {
        if (locale === CANONICAL_LOCALE) continue;
        const candidatePath = path.join(localeRoot, locale, fileName);
        const candidate = parse(fs.readFileSync(candidatePath, 'utf8'), candidatePath);
        if (isFluent) compareFluent(canonical, candidate, locale, fileName, errors);
        else {
          compareSets(new Set(canonical.keys()), new Set(candidate.keys()), `${locale}/${fileName} entities`, errors);
          for (const [entity, expectedValue] of canonical) {
            if (expectedValue && candidate.has(entity) && !candidate.get(entity)) {
              errors.push(`${locale}/${fileName}:${entity} has an empty value`);
            }
          }
        }
      }
    }
  }

  if (errors.length) throw new Error(`Locale validation failed:\n- ${errors.join('\n- ')}`);
  if (!options.quiet) console.log(`Locale validation passed: ${sorted(directories).join(', ')}`);
  return { locales: sorted(directories), requiredFiles: [...REQUIRED_FILES] };
}

function runSelfTest() {
  const expected = parseFluent('entry = Hello { $name }\n    .label = Open { $count }');
  const exact = parseFluent('entry = 您好 { $name }\n    .label = 開啟 { $count }');
  const exactErrors = [];
  compareFluent(expected, exact, 'test', 'test.ftl', exactErrors);
  assert.deepStrictEqual(exactErrors, []);
  const drift = parseFluent('entry = 您好 { $person }\n    .tooltiptext = 開啟');
  const driftErrors = [];
  compareFluent(expected, drift, 'test', 'test.ftl', driftErrors);
  assert(driftErrors.some(error => error.includes('attributes')));
  assert(driftErrors.some(error => error.includes('variables')));
  const emptyErrors = [];
  compareFluent(expected, parseFluent('entry =\n    .label ='), 'test', 'test.ftl', emptyErrors);
  assert(emptyErrors.some(error => error.includes('empty value')));
  const multiline = parseFluent('entry = Base\n    .label = First\n        { NUMBER($count) }');
  assert.strictEqual(multiline.get('entry').value, 'Base');
  assert.strictEqual(multiline.get('entry').attributes.get('label'), 'First\n{ NUMBER($count) }');
  assert.deepStrictEqual(sorted(variablesIn(multiline.get('entry').attributes.get('label'))), ['count']);
  const dtd = parseDtd('<!ENTITY first "One">\n<!ENTITY second \'Two\'>');
  assert.deepStrictEqual(sorted(dtd.keys()), ['first', 'second']);
  assert.strictEqual(dtd.get('first'), 'One');
  assert.deepStrictEqual(sorted(registeredLocales('["locale", "zotseek", "en-US", rootURI]')), ['en-US']);
  console.log('Locale validator self-test passed');
}

if (require.main === module) {
  try {
    if (process.argv.includes('--self-test')) runSelfTest();
    else checkLocales();
  } catch (error) {
    console.error(error.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = { checkLocales, compareFluent, parseDtd, parseFluent, registeredLocales };
