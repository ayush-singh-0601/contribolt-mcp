import type { Repository } from '../core/models.js';
export function policyKey(repo: Repository): string {
  return repo.forge === 'github' && repo.host === 'github.com'
    ? repo.fullName
    : `${repo.forge}:${repo.host}:${repo.id}`;
}
