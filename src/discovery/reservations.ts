import type { GitHubClient } from '../github/client.js';
import type { IssueEvidence, Repository } from '../core/models.js';
import type { PolicyDocument } from '../repository/policy-sources.js';
import { referencesIssue } from './competing.js';
interface ProjectField {
  __typename: string;
  name?: string;
  text?: string;
  field?: { name: string };
  users?: { nodes: { login: string }[]; pageInfo: { hasNextPage: boolean } };
}
export async function reservationSources(
  client: GitHubClient,
  repo: Repository,
  issue: IssueEvidence,
  documents: PolicyDocument[],
  signal?: AbortSignal,
): Promise<{ reservations: string[]; complete: boolean; urls: string[] }> {
  const reservations: string[] = [],
    urls: string[] = [];
  let complete = true;
  for (const hint of issue.reservationHints)
    if (/reserved|claimed|owner\s*[:=@]|assigned to|working on/i.test(hint))
      reservations.push('Milestone ownership: ' + hint);
  for (const doc of documents)
    for (const line of doc.text.split('\n'))
      if (
        referencesIssue(line, repo.fullName, issue.issueNumber) &&
        /reserved|claimed|assigned to|working on|owner\s*[:=@]/i.test(line)
      ) {
        reservations.push(line.slice(0, 1000));
        urls.push(doc.url);
      }
  try {
    const branches = await client.pages<{ name: string }>(
      `/repos/${repo.fullName}/branches`,
      {},
      200,
      signal,
    );
    complete &&= branches.complete;
    const pattern = new RegExp(
      `(?:^|[/_-])(?:issues?[/_-]?|fix[/_-]?)${issue.issueNumber}(?:$|[/_-])`,
      'i',
    );
    for (const branch of branches.items)
      if (pattern.test(branch.name)) {
        reservations.push('Existing upstream branch suggests active work: ' + branch.name);
        urls.push(repo.url + '/tree/' + encodeURIComponent(branch.name));
      }
  } catch {
    signal?.throwIfAborted();
    complete = false;
  }
  try {
    const [owner, name] = repo.fullName.split('/'),
      data = await client.graphql<{
        repository: {
          issue: {
            projectItems?: {
              nodes: ({
                project: { url: string };
                fieldValues: { nodes: (ProjectField | null)[]; pageInfo: { hasNextPage: boolean } };
              } | null)[];
              pageInfo: { hasNextPage: boolean };
            };
          } | null;
        };
      }>(
        `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){issue(number:$number){projectItems(first:20){pageInfo{hasNextPage}nodes{project{url}fieldValues(first:50){pageInfo{hasNextPage}nodes{__typename ... on ProjectV2ItemFieldUserValue{field{... on ProjectV2Field{name}} users(first:20){nodes{login}pageInfo{hasNextPage}}} ... on ProjectV2ItemFieldSingleSelectValue{name field{... on ProjectV2SingleSelectField{name}}} ... on ProjectV2ItemFieldTextValue{text field{... on ProjectV2Field{name}}}}}}}}}}`,
        { owner, name, number: issue.issueNumber },
        signal,
      );
    const items = data.repository.issue?.projectItems;
    if (!items) complete = false;
    else {
      complete &&= !items.pageInfo.hasNextPage;
      for (const item of items.nodes) {
        if (!item) {
          complete = false;
          continue;
        }
        urls.push(item.project.url);
        complete &&= !item.fieldValues.pageInfo.hasNextPage;
        for (const field of item.fieldValues.nodes) {
          if (!field) {
            complete = false;
            continue;
          }
          if (field.users) {
            complete &&= !field.users.pageInfo.hasNextPage;
            if (field.users.nodes.length)
              reservations.push(
                'Project owner/user field: ' + field.users.nodes.map((u) => u.login).join(', '),
              );
          }
          if (field.__typename === 'ProjectV2ItemIssueFieldValue') complete = false;
          if (/status|ownership|assignee|owner/i.test(field.field?.name ?? '')) {
            const value = field.name ?? field.text ?? '';
            if (
              /in progress|in development|claimed|reserved|assigned|working|in review|done/i.test(
                value,
              )
            )
              reservations.push('Project ' + field.field?.name + ': ' + value);
            else if (
              value &&
              !/^(todo|to do|backlog|ready|open|triage|unassigned|available)$/i.test(value)
            )
              complete = false;
          }
        }
      }
    }
  } catch {
    signal?.throwIfAborted();
    complete = false;
  }
  return { reservations, complete, urls: [...new Set(urls)] };
}
