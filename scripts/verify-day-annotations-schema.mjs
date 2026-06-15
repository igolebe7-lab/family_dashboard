import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(root, 'pocketbase', 'pb_migrations');
const hooksDir = join(root, 'pocketbase', 'pb_hooks');

const migrationText = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.js'))
  .map((file) => readFileSync(join(migrationsDir, file), 'utf8'))
  .join('\n');

assertIncludes(migrationText, "name: 'day_annotations'", 'day_annotations collection');
assertIncludes(migrationText, "select('kind'", 'kind select field');
assertIncludes(migrationText, "'birthday'", 'birthday kind');
assertIncludes(migrationText, "'public_holiday'", 'public_holiday kind');
assertIncludes(migrationText, "number('month'", 'month number field');
assertIncludes(migrationText, "number('day'", 'day number field');
assertIncludes(migrationText, "number('year'", 'year number field');
assertIncludes(migrationText, "select('recurrence'", 'recurrence select field');
assertIncludes(migrationText, "'yearly'", 'yearly recurrence');
assertIncludes(migrationText, "select('color'", 'color select field');
assertIncludes(migrationText, "text('person_contact'", 'optional person contact field');
assertIncludes(migrationText, "CREATE INDEX idx_day_annotations_family_month_day", 'family month/day index');
assertIncludes(migrationText, "CREATE INDEX idx_day_annotations_source", 'source index');

const hookText = readFileSync(join(hooksDir, 'day_annotations.pb.js'), 'utf8');
assertIncludes(hookText, "onRecordCreateRequest", 'create hook');
assertIncludes(hookText, "onRecordUpdateRequest", 'update hook');
assertIncludes(hookText, "validateDayAnnotationRecord", 'shared validation call');

const validationText = readFileSync(join(hooksDir, '_shared', 'day-annotations.pb.js'), 'utf8');
assertIncludes(validationText, 'validateDayAnnotationRecord', 'shared validator export');
assertIncludes(validationText, 'person_contact', 'person contact validation');
assertIncludes(validationText, 'readonly', 'readonly guard');

console.log('day_annotations schema verification passed');

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}
