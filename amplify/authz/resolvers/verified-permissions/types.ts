export type IsAuthorizedResponse = {
  decision: "ALLOW" | "DENY";
  determiningPolicies: Array<DeterminingPolicyItem>;
  errors?: Array<EvaluationErrorItem>;
};

export type EvaluationErrorItem = {
  errorDescription: string;
};

export type EntityIdentifier = {
  entityId: string;
  entityType: string;
};

export type AttributeValue = {
  boolean?: boolean;
  decimal?: string;
  ipaddr?: string;
  long?: number;
  entityIdentifier?: EntityIdentifier;
  record?: Record<string, AttributeValue>;
  set?: AttributeValue[];
  string?: string;
};

export type EntityItem = {
  identifier: EntityIdentifier;
  attributes?: Record<string, AttributeValue>;
  parents?: EntityIdentifier[];
};

export type EntitiesDefinition = {
  entityList: EntityItem[];
};

export type BatchIsAuthorizedRequest = {
  entities: EntitiesDefinition;
  policyStoreId: string;
  requests: BatchIsAuthorizedInputItem[];
};

export type ActionIdentifier = {
  actionId: string;
  actionType: string;
};

export type ContextDefinition = {
  cedarJson?: string;
  contextMap?: Record<string, AttributeValue>;
};

export type BatchIsAuthorizedInputItem = {
  action: ActionIdentifier;
  context: ContextDefinition;
  principal: EntityIdentifier;
  resource: EntityIdentifier;
};

export type BatchIsAuthorizedOutput = {
  results: BatchIsAuthorizedOutputItem[];
};

export type DeterminingPolicyItem = {
  policyId: string;
};

export type BatchIsAuthorizedOutputItem = {
  decision: "ALLOW" | "DENY";
  determiningPolicies: DeterminingPolicyItem[];
  errors: EvaluationErrorItem[];
  request: BatchIsAuthorizedInputItem;
};
