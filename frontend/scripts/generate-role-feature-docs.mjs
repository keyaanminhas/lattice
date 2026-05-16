import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { roleCapabilityMatrix, roleLabels } from '../src/config/roleCapabilityMatrix.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'public', 'role-feature-matrix.md');

const rowsByRole = Object.keys(roleLabels).map((roleKey) => ({
  roleKey,
  label: roleLabels[roleKey],
  items: roleCapabilityMatrix.filter((capability) => capability.roleKeys.includes(roleKey)),
}));

let markdown = '# Lattice Role Feature Matrix\n\n';
markdown += `Generated: ${new Date().toISOString()}\n\n`;
for (const role of rowsByRole) {
  markdown += `## ${role.label}\n\n`;
  markdown += '| Capability | Action | Scope | Surface | ID |\n';
  markdown += '|---|---|---|---|---|\n';
  for (const capability of role.items) {
    markdown += `| ${capability.label} | ${capability.actionType} | ${capability.scope} | ${capability.surface} | \`${capability.capabilityId}\` |\n`;
  }
  markdown += '\n';
}

fs.writeFileSync(target, markdown, 'utf8');
console.log(`Generated ${target}`);

