export interface WorkflowImporter {
  importRunningHub(workflowId: string): Promise<string>;
  importComfyApi(definition: Record<string, unknown>): Promise<string>;
}
