import { module } from 'angular';

import { IPipeline, IPipelineTrigger, IStage, IStageOrTriggerTypeConfig, ITrigger } from 'core/domain';
import { PipelineConfigService } from 'core/pipeline/config/services/PipelineConfigService';
import {
  IStageOrTriggerValidator,
  IValidatorConfig,
  PIPELINE_CONFIG_VALIDATOR,
  PipelineConfigValidator,
} from './pipelineConfig.validator';

export interface IStageOrTriggerBeforeTypeValidationConfig extends IValidatorConfig {
  stageTypes?: string[];
  stageType?: string;
  checkParentTriggers?: boolean;
  message: string;
}

export class StageOrTriggerBeforeTypeValidator implements IStageOrTriggerValidator {
  // Stores application pipeline configs so we don't needlessly fetch them every time we validate the pipeline
  private pipelineCache: Map<string, IPipeline[]> = new Map();

  constructor(private $q: ng.IQService) {
    'ngInject';
  }

  // Exposed for testing
  public clearCache() {
    this.pipelineCache.clear();
  }

  public validate(
    pipeline: IPipeline,
    stage: IStage,
    validator: IStageOrTriggerBeforeTypeValidationConfig,
    _config: IStageOrTriggerTypeConfig,
  ): ng.IPromise<string> {
    const stageTypes = validator.stageTypes || [validator.stageType];
    const stagesToTest: Array<IStage | ITrigger> = PipelineConfigService.getAllUpstreamDependencies(pipeline, stage);
    stagesToTest.push(...pipeline.triggers);

    const parentTriggersToCheck = validator.checkParentTriggers ? this.addPipelineTriggers(pipeline, stagesToTest) : [];
    return this.$q.all(parentTriggersToCheck).then(() => {
      if (stagesToTest.every(test => !stageTypes.includes(test.type))) {
        return validator.message;
      }
      return null;
    });
  }

  private addTriggers(pipelines: IPipeline[], pipelineIdToFind: string, stagesToTest: Array<IStage | ITrigger>): void {
    const match = pipelines.find(p => p.id === pipelineIdToFind);
    if (match) {
      stagesToTest.push(...match.triggers);
    }
  }

  private addExternalTriggers(
    trigger: IPipelineTrigger,
    stagesToTest: Array<IStage | ITrigger>,
    deferred: ng.IDeferred<any>,
  ): void {
    PipelineConfigService.getPipelinesForApplication(trigger.application).then(pipelines => {
      this.pipelineCache.set(trigger.application, pipelines);
      this.addTriggers(pipelines, trigger.pipeline, stagesToTest);
      deferred.resolve();
    });
  }

  private addPipelineTriggers(pipeline: IPipeline, stagesToTest: Array<IStage | ITrigger>) {
    const pipelineTriggers: IPipelineTrigger[] = pipeline.triggers.filter(
      t => t.type === 'pipeline',
    ) as IPipelineTrigger[];
    const parentTriggersToCheck: Array<ng.IPromise<any>> = [];
    pipelineTriggers.forEach(trigger => {
      const deferred: ng.IDeferred<any> = this.$q.defer();
      if (this.pipelineCache.has(trigger.application)) {
        this.addTriggers(this.pipelineCache.get(trigger.application), trigger.pipeline, stagesToTest);
      } else {
        this.addExternalTriggers(trigger, stagesToTest, deferred);
        parentTriggersToCheck.push(deferred.promise);
      }
    });
    return parentTriggersToCheck;
  }
}

export const STAGE_OR_TRIGGER_BEFORE_TYPE_VALIDATOR =
  'spinnaker.core.pipeline.validation.config.stageOrTriggerBeforeType';
module(STAGE_OR_TRIGGER_BEFORE_TYPE_VALIDATOR, [PIPELINE_CONFIG_VALIDATOR])
  .service('stageOrTriggerBeforeTypeValidator', StageOrTriggerBeforeTypeValidator)
  .run(
    (
      pipelineConfigValidator: PipelineConfigValidator,
      stageOrTriggerBeforeTypeValidator: StageOrTriggerBeforeTypeValidator,
    ) => {
      pipelineConfigValidator.registerValidator('stageOrTriggerBeforeType', stageOrTriggerBeforeTypeValidator);
    },
  );
