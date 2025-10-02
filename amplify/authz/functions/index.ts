import {
  CfnResolver,
  DynamoDbDataSource,
  HttpDataSource,
  IGraphqlApi,
  CfnDataSource,
} from "aws-cdk-lib/aws-appsync";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { IResolvable, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  createBatchIsAuthorizedFunction,
  createFetchPrincipalAttrsFunction,
  createGetItemFromModelFilterFunction,
  createGetItemFunction,
  createGetParentFunction,
  createIsAuthorizedFunction,
} from "./createAppSyncFunctions";

export function addAuthFunctionsToResolvers(
  graphqlApi: IGraphqlApi,
  logicalId: string,
  resolver: CfnResolver,
  cfnDataSources: Record<string, CfnDataSource>,
  tables: Record<string, dynamodb.ITable>,
  policyStoreId: string,
  verifiedPermissionsDataSource: HttpDataSource,
  projectMemberDataSource: DynamoDbDataSource
) {
  if (logicalId.startsWith("Query.get")) {
    addAuthFunctionsToGetResolver(
      graphqlApi,
      logicalId,
      resolver,
      cfnDataSources,
      policyStoreId,
      verifiedPermissionsDataSource,
      projectMemberDataSource
    );
  } else if (logicalId.startsWith("Query.list")) {
    addAuthFunctionsToListResolver(
      graphqlApi,
      logicalId,
      resolver,
      cfnDataSources,
      policyStoreId,
      verifiedPermissionsDataSource,
      projectMemberDataSource
    );
  } else if (logicalId.startsWith("Mutation.create")) {
    addAuthFunctionsToCreateResolver(
      graphqlApi,
      logicalId,
      resolver,
      cfnDataSources,
      policyStoreId,
      verifiedPermissionsDataSource,
      projectMemberDataSource
    );
  } else if (logicalId.startsWith("Mutation.update")) {
    addAuthFunctionsToUpdateResolver(
      graphqlApi,
      logicalId,
      resolver,
      cfnDataSources,
      policyStoreId,
      verifiedPermissionsDataSource,
      projectMemberDataSource
    );
  } else if (logicalId.startsWith("Mutation.delete")) {
    addAuthFunctionsToDeleteResolver(
      graphqlApi,
      logicalId,
      resolver,
      cfnDataSources,
      policyStoreId,
      verifiedPermissionsDataSource,
      projectMemberDataSource
    );
  } else if (logicalId.startsWith("Subscription.")) {
    addAuthFunctionsToSubscriptionResolver(
      graphqlApi,
      logicalId,
      resolver,
      cfnDataSources,
      tables,
      policyStoreId,
      verifiedPermissionsDataSource,
      projectMemberDataSource
    );
  } else {
    addAuthFunctionsToDefaultResolver(
      graphqlApi,
      logicalId,
      resolver,
      cfnDataSources,
      policyStoreId,
      verifiedPermissionsDataSource,
      projectMemberDataSource
    );
  }
}

function addAuthFunctionsToListResolver(
  graphqlApi: IGraphqlApi,
  logicalId: string,
  resolver: CfnResolver,
  cfnDataSources: Record<string, CfnDataSource>,
  policyStoreId: string,
  verifiedPermissionsDataSource: HttpDataSource,
  projectMemberDataSource: DynamoDbDataSource
) {
  return addAuthFunctionsToResolver(
    graphqlApi,
    logicalId,
    resolver,
    cfnDataSources,
    {},
    policyStoreId,
    (functions, construct) => {
      const idPrefix = logicalId.replaceAll(".", "");
      const fetchPrincipalAttrs = createFetchPrincipalAttrsFunction(
        construct,
        idPrefix,
        graphqlApi,
        projectMemberDataSource
      );
      const batchIsAuthorizedFunction = createBatchIsAuthorizedFunction(
        construct,
        idPrefix,
        graphqlApi,
        verifiedPermissionsDataSource
      );

      const [auth, postAuth, data] = functions;

      return [
        auth,
        postAuth,
        fetchPrincipalAttrs.functionId,
        data,
        batchIsAuthorizedFunction.functionId,
      ];
    }
  );
}

function addAuthFunctionsToDefaultResolver(
  graphqlApi: IGraphqlApi,
  logicalId: string,
  resolver: CfnResolver,
  cfnDataSources: Record<string, CfnDataSource>,
  policyStoreId: string,
  verifiedPermissionsDataSource: HttpDataSource,
  projectMemberDataSource: DynamoDbDataSource
) {
  return addAuthFunctionsToResolver(
    graphqlApi,
    logicalId,
    resolver,
    cfnDataSources,
    {},
    policyStoreId,
    (functions, construct) => {
      const idPrefix = logicalId.replaceAll(".", "");
      const fetchPrincipalAttrs = createFetchPrincipalAttrsFunction(
        construct,
        idPrefix,
        graphqlApi,
        projectMemberDataSource
      );
      const isAuthorizedFunction = createIsAuthorizedFunction(
        construct,
        idPrefix,
        graphqlApi,
        verifiedPermissionsDataSource
      );
      const preFunctions = functions.slice(0, -1);
      const dataFunction = functions[functions.length - 1];
      return [
        ...preFunctions,
        fetchPrincipalAttrs.functionId,
        dataFunction,
        isAuthorizedFunction.functionId,
      ];
    }
  );
}

function addAuthFunctionsToResolver(
  graphqlApi: IGraphqlApi,
  logicalId: string,
  resolver: CfnResolver,
  cfnDataSources: Record<string, CfnDataSource>,
  tables: Record<string, dynamodb.ITable>,
  policyStoreId: string,
  appender: (functions: string[], construct: Construct) => string[]
) {
  const pipelineConfig = resolver.pipelineConfig;
  if (!isPipelineConfigProperty(pipelineConfig)) {
    console.warn(
      `  Pipeline config for ${logicalId} is not PipelineConfigProperty. it isn't supported.`
    );
    return;
  }
  const functions = pipelineConfig.functions;
  if (!functions) {
    console.warn(`  No functions found in pipeline config for GetResolver.`);
    return;
  }
  const stack = Stack.of(resolver);
  const appendedFunctions = appender(functions, stack);
  resolver.addPropertyOverride("PipelineConfig.Functions", appendedFunctions);
  // Set the response mapping template

  const tableMap = Object.entries(tables).reduce(
    (acc, [key, table]) => {
      acc[key] = table.tableName;
      return acc;
    },
    {} as Record<string, string>
  );

  // To reference userAttributes via `ctx.source` in child resolver.
  const responseMappingTemplate = `#if($ctx.stash.userAttributes)
  #set($ctx.prev.result.userAttributes = $ctx.stash.userAttributes)
#end
$util.toJson($ctx.prev.result)
`;
  resolver.responseMappingTemplate = responseMappingTemplate;
  resolver.requestMappingTemplate = `$util.qr($ctx.stash.put("policyStoreId", "${policyStoreId}"))
$util.qr($ctx.stash.put("tables", ${JSON.stringify(tableMap)}))
${resolver.requestMappingTemplate}`;
}

function addAuthFunctionsToCreateResolver(
  graphqlApi: IGraphqlApi,
  logicalId: string,
  resolver: CfnResolver,
  cfnDataSources: Record<string, CfnDataSource>,
  policyStoreId: string,
  verifiedPermissionsDataSource: HttpDataSource,
  projectMemberDataSource: DynamoDbDataSource
) {
  return addAuthFunctionsToResolver(
    graphqlApi,
    logicalId,
    resolver,
    cfnDataSources,
    {},
    policyStoreId,
    (functions, construct) => {
      const idPrefix = logicalId.replaceAll(".", "");
      const fetchPrincipalAttrs = createFetchPrincipalAttrsFunction(
        construct,
        idPrefix,
        graphqlApi,
        projectMemberDataSource
      );
      const isAuthorizedFunction = createIsAuthorizedFunction(
        construct,
        idPrefix,
        graphqlApi,
        verifiedPermissionsDataSource
      );
      const getParentFunction = createGetParentFunction(
        construct,
        logicalId,
        graphqlApi,
        cfnDataSources
      );

      const data = functions[functions.length - 1];
      const preFunctions = functions.slice(0, -1);

      return [
        ...preFunctions,
        fetchPrincipalAttrs.functionId,
        getParentFunction.attrFunctionId,
        isAuthorizedFunction.functionId,
        data,
      ];
    }
  );
}

function addAuthFunctionsToUpdateResolver(
  graphqlApi: IGraphqlApi,
  logicalId: string,
  resolver: CfnResolver,
  cfnDataSources: Record<string, CfnDataSource>,
  policyStoreId: string,
  verifiedPermissionsDataSource: HttpDataSource,
  projectMemberDataSource: DynamoDbDataSource
) {
  return addAuthFunctionsToResolver(
    graphqlApi,
    logicalId,
    resolver,
    cfnDataSources,
    {},
    policyStoreId,
    (functions, construct) => {
      const idPrefix = logicalId.replaceAll(".", "");
      const fetchPrincipalAttrs = createFetchPrincipalAttrsFunction(
        construct,
        idPrefix,
        graphqlApi,
        projectMemberDataSource
      );
      const isAuthorizedFunction = createIsAuthorizedFunction(
        construct,
        idPrefix,
        graphqlApi,
        verifiedPermissionsDataSource
      );
      const getItemFunction = createGetItemFunction(
        construct,
        logicalId,
        graphqlApi,
        cfnDataSources
      );

      const data = functions[functions.length - 1];
      const preFunctions = functions.slice(0, -1);

      return [
        ...preFunctions,
        fetchPrincipalAttrs.functionId,
        getItemFunction.attrFunctionId,
        isAuthorizedFunction.functionId,
        data,
      ];
    }
  );
}

function addAuthFunctionsToDeleteResolver(
  graphqlApi: IGraphqlApi,
  logicalId: string,
  resolver: CfnResolver,
  cfnDataSources: Record<string, CfnDataSource>,
  policyStoreId: string,
  verifiedPermissionsDataSource: HttpDataSource,
  projectMemberDataSource: DynamoDbDataSource
) {
  return addAuthFunctionsToResolver(
    graphqlApi,
    logicalId,
    resolver,
    cfnDataSources,
    {},
    policyStoreId,
    (functions, construct) => {
      const idPrefix = logicalId.replaceAll(".", "");
      const fetchPrincipalAttrs = createFetchPrincipalAttrsFunction(
        construct,
        idPrefix,
        graphqlApi,
        projectMemberDataSource
      );
      const isAuthorizedFunction = createIsAuthorizedFunction(
        construct,
        idPrefix,
        graphqlApi,
        verifiedPermissionsDataSource
      );
      const getItemFunction = createGetItemFunction(
        construct,
        logicalId,
        graphqlApi,
        cfnDataSources
      );

      const data = functions[functions.length - 1];
      const preFunctions = functions.slice(0, -1);

      return [
        ...preFunctions,
        fetchPrincipalAttrs.functionId,
        getItemFunction.attrFunctionId,
        isAuthorizedFunction.functionId,
        data,
      ];
    }
  );
}

function addAuthFunctionsToGetResolver(
  graphqlApi: IGraphqlApi,
  logicalId: string,
  resolver: CfnResolver,
  cfnDataSources: Record<string, CfnDataSource>,
  policyStoreId: string,
  verifiedPermissionsDataSource: HttpDataSource,
  projectMemberDataSource: DynamoDbDataSource
) {
  return addAuthFunctionsToResolver(
    graphqlApi,
    logicalId,
    resolver,
    cfnDataSources,
    {},
    policyStoreId,
    (functions, construct) => {
      const idPrefix = logicalId.replaceAll(".", "");
      const fetchPrincipalAttrs = createFetchPrincipalAttrsFunction(
        construct,
        idPrefix,
        graphqlApi,
        projectMemberDataSource
      );
      const isAuthorizedFunction = createIsAuthorizedFunction(
        construct,
        idPrefix,
        graphqlApi,
        verifiedPermissionsDataSource
      );

      const [auth, postAuth, data] = functions;

      return [
        auth,
        postAuth,
        fetchPrincipalAttrs.functionId,
        data,
        isAuthorizedFunction.functionId,
      ];
    }
  );
}

function addAuthFunctionsToSubscriptionResolver(
  graphqlApi: IGraphqlApi,
  logicalId: string,
  resolver: CfnResolver,
  cfnDataSources: Record<string, CfnDataSource>,
  tables: Record<string, dynamodb.ITable>,
  policyStoreId: string,
  verifiedPermissionsDataSource: HttpDataSource,
  projectMemberDataSource: DynamoDbDataSource
) {
  const filteredTables = filterTables(logicalId, tables);
  return addAuthFunctionsToResolver(
    graphqlApi,
    logicalId,
    resolver,
    cfnDataSources,
    filteredTables,
    policyStoreId,
    (functions, construct) => {
      const idPrefix = logicalId.replaceAll(".", "");
      const fetchPrincipalAttrs = createFetchPrincipalAttrsFunction(
        construct,
        idPrefix,
        graphqlApi,
        projectMemberDataSource
      );
      const isAuthorizedFunction = createIsAuthorizedFunction(
        construct,
        idPrefix,
        graphqlApi,
        verifiedPermissionsDataSource
      );

      const getItemFromModelFilterFunction =
        createGetItemFromModelFilterFunction(
          construct,
          idPrefix,
          graphqlApi,
          verifiedPermissionsDataSource
        );

      const data = functions[functions.length - 1];
      const preFunctions = functions.slice(0, -1);

      return [
        ...preFunctions,
        fetchPrincipalAttrs.functionId,
        getItemFromModelFilterFunction.functionId,
        isAuthorizedFunction.functionId,
        data,
      ];
    }
  );
}

function filterTables(
  logicalId: string,
  tables: Record<string, dynamodb.ITable>
) {
  const subscriptionEntitiesInHierarchy: Record<string, string[]> = {
    Project: ["Project"],
    Folder: ["Folder", "Project"],
    File: ["File", "Folder", "Project"],
  };
  const [, fieldName] = logicalId.split(".");
  const entityName = fieldName.replace(/^on(Create|Update|Delete)/, "");
  const entities = subscriptionEntitiesInHierarchy[entityName];
  if (!entities) {
    return {};
  }
  return entities.reduce(
    (acc, entityName) => {
      acc[entityName] = tables[entityName];
      return acc;
    },
    {} as Record<string, dynamodb.ITable>
  );
}

function isPipelineConfigProperty(
  pipelineConfig: IResolvable | CfnResolver.PipelineConfigProperty | undefined
): pipelineConfig is CfnResolver.PipelineConfigProperty {
  return !!pipelineConfig && "functions" in pipelineConfig;
}
