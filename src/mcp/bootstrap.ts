import {Application} from './application.js';
import type {Store} from '../state/store.js';
import {registerDiscovery} from './discovery-tools.js';
import {registerAnalysis} from './analysis-tools.js';
import {registerExecution} from './execution-tools.js';
import {registerQuality} from './quality-tools.js';
import {registerPreparation} from './preparation-tools.js';
import {registerApprovals} from './approval-tools.js';
import {registerPublication} from './publication-tools.js';
import {registerReviews} from './review-tools.js';
import {registerMonitoring} from './monitoring-tools.js';
import {registerRevisions} from './revision-tools.js';
import type {createWorkspace} from '../git/workspace.js';
import type {Provider} from '../forges/router.js';
import type {Publisher} from '../contribution/publisher.js';
import type {RevisionPush} from '../contribution/revisions.js';
export interface ApplicationDependencies {workspaceFactory?:typeof createWorkspace;publicationFactory?:(context:Provider)=>Publisher;revisionPush?:RevisionPush;}
export function createApplication(store:Store,deps:ApplicationDependencies={}):Application{
  const app=new Application(store);registerDiscovery(app);registerAnalysis(app,deps.workspaceFactory);registerExecution(app);registerQuality(app);registerPreparation(app);registerApprovals(app);registerPublication(app,deps.publicationFactory);registerReviews(app);registerMonitoring(app);registerRevisions(app,deps.revisionPush);return app;
}
