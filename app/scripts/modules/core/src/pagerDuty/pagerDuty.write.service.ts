import { IPromise, module } from 'angular';

import { Application } from 'core/application';
import { ModalInjector } from 'core/reactShims';
import { IJob, TaskExecutor, ITaskCommand } from 'core/task/taskExecutor';

export class PagerDutyWriter {
  public pageApplicationOwnerModal(app: Application): void {
    ModalInjector.modalService
      .open({
        templateUrl: require('./pageApplicationOwner.html'),
        controller: 'PageModalCtrl as ctrl',
        resolve: {
          application: () => app,
        },
      })
      .result.catch(() => {});
  }

  public sendPage(
    applications: Application[],
    keys: string[],
    reason: string,
    details?: { [key: string]: any },
  ): IPromise<any> {
    const job = {
      type: 'pageApplicationOwner',
      message: reason,
      details,
    } as IJob;

    if (applications && applications.length > 0) {
      job.applications = applications.map(app => app.name);
    }

    if (keys && keys.length > 0) {
      job.keys = keys;
    }

    const task = {
      job: [job],
      description: 'Send Page',
    } as ITaskCommand;

    // If only one application was passed in, assign ownership
    if (applications && applications.length === 1) {
      task.application = applications[0];
    }

    return TaskExecutor.executeTask(task);
  }

  public pageApplicationOwner(application: Application, reason: string, details?: string): IPromise<any> {
    return this.sendPage([application], undefined, reason, { details });
  }
}

export const PAGER_DUTY_WRITE_SERVICE = 'spinnaker.core.pagerDuty.write.service';
module(PAGER_DUTY_WRITE_SERVICE, []).service('pagerDutyWriter', PagerDutyWriter);
