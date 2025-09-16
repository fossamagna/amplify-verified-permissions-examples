export type IsAuthorizedResponse = {
  decision: "ALLOW" | "DENY";
  determiningPolicies: Array<{
    policyId: string;
  }>;
  errors?: Array<{
    errorDescription: string;
  }>;
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
  attributes: Record<string, AttributeValue>;
  parents?: EntityIdentifier[];
};

export type EntitiesDefinition = {
  entityList: EntityItem[];
};
