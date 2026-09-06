// Exports the site with a build id baked in, writes the same id to
// public/version.json, and deploys. The running page compares the two and
// reloads itself when a newer version has been published, so a phone that
// cached the old page picks up fixes without anyone clearing anything.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const id = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
writeFileSync('public/version.json', JSON.stringify({ id }) + '\n');
const env = { ...process.env, EXPO_PUBLIC_BUILD_ID: id, CI: '1' };
execSync('npx expo export --platform web --clear', { stdio: 'inherit', env });
execSync('eas deploy --prod --non-interactive', { stdio: 'inherit', env });
console.log(`deployed build ${id}`);
