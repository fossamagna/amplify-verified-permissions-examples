import {
  CfnResolver,
  DynamoDbDataSource,
  HttpDataSource,
  IGraphqlApi,
  CfnDataSource,
} from "aws-cdk-lib/aws-appsync";
import { IResolvable, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  createBatchIsAuthorizedFunction,
  createFetchPrincipalAttrsFunction,
  createGetItemFunction,
  createGetParentFunction,
  createIsAuthorizedFunction,
} from "./createAppSyncFunctions";

export function addAuthFunctionsToResolvers(
  graphqlApi: IGraphqlApi,
  logicalId: string,
  resolver: CfnResolver,
  cfnDataSources: Record<string, CfnDataSource>,
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
    //addAuthFunctionsToSubscriptionResolver(graphqlApi, logicalId, resolver);
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
  // To reference userAttributes via `ctx.source` in child resolver.
  const responseMappingTemplate = `#if($ctx.stash.userAttributes)
  #set($ctx.prev.result.userAttributes = $ctx.stash.userAttributes)
#end
$util.toJson($ctx.prev.result)
`;
  resolver.responseMappingTemplate = responseMappingTemplate;
  resolver.requestMappingTemplate = `$util.qr($ctx.stash.put("policyStoreId", "${policyStoreId}"))
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

function isPipelineConfigProperty(
  pipelineConfig: IResolvable | CfnResolver.PipelineConfigProperty | undefined
): pipelineConfig is CfnResolver.PipelineConfigProperty {
  return !!pipelineConfig && "functions" in pipelineConfig;
}
