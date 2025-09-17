
import path from "node:path";

import {
  AppsyncFunction,
  CfnResolver,
  Code,
  DynamoDbDataSource,
  HttpDataSource,
  FunctionRuntime,
  IGraphqlApi,
} from "aws-cdk-lib/aws-appsync";
import { IResolvable, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { build } from "../build";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const resolversDir = path.join(__dirname, "..", "resolvers");

const responseMappingTemplate = `#if($ctx.stash.userAttributes)
  #set($ctx.prev.result.userAttributes = $ctx.stash.userAttributes)
#end
$util.toJson($ctx.prev.result)
`;

export function addAuthFunctionsToListResolver(
  graphqlApi: IGraphqlApi,
  logicalId: string,
  resolver: CfnResolver,
  policyStoreId: string,
  verifiedPermissionsDataSource: HttpDataSource,
  projectMemberDataSource: DynamoDbDataSource
) {
  return addAuthFunctionsToResolver(
    graphqlApi,
    logicalId,
    resolver,
    policyStoreId,
    (functions, construct) => {
      const idPrefix = logicalId.replaceAll(".", "");
      const id = `${idPrefix}FetchPrincipalAttrsFn`;
      const buildResult = build(
        path.join(resolversDir, "fetchPrincipalAttrs.ts")
      );
      const fetchPrincipalAttrs = new AppsyncFunction(construct, id, {
        api: graphqlApi,
        name: id,
        dataSource: projectMemberDataSource,
        runtime: FunctionRuntime.JS_1_0_0,
        code: Code.fromInline(buildResult.text),
      });

      const batchIsAuthorizedBuildResult = build(
        path.join(resolversDir, "batchIsAuthorized.ts")
      );
      const batchIsAuthorizedFunctionId = `${idPrefix}BatchIsAuthorizedFn`;
      const batchIsAuthorizedFunction = new AppsyncFunction(
        construct,
        batchIsAuthorizedFunctionId,
        {
          api: graphqlApi,
          name: batchIsAuthorizedFunctionId,
          dataSource: verifiedPermissionsDataSource,
          runtime: FunctionRuntime.JS_1_0_0,
          code: Code.fromInline(batchIsAuthorizedBuildResult.text),
        }
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

export function addAuthFunctionsToResolvers(
  graphqlApi: IGraphqlApi,
  logicalId: string,
  resolver: CfnResolver,
  policyStoreId: string,
  verifiedPermissionsDataSource: HttpDataSource,
  projectMemberDataSource: DynamoDbDataSource
) {
  if (logicalId.startsWith("Query.get")) {
    addAuthFunctionsToGetResolver(
      graphqlApi,
      logicalId,
      resolver,
      policyStoreId,
      verifiedPermissionsDataSource,
      projectMemberDataSource
    );
  } else if (logicalId.startsWith("Query.list")) {
    addAuthFunctionsToListResolver(
      graphqlApi,
      logicalId,
      resolver,
      policyStoreId,
      verifiedPermissionsDataSource,
      projectMemberDataSource
    );
  } else if (logicalId.startsWith("Mutation.")) {
    //addAuthFunctionsToMutationResolver(graphqlApi, logicalId, resolver);
  } else if (logicalId.startsWith("Subscription.")) {
    //addAuthFunctionsToSubscriptionResolver(graphqlApi, logicalId, resolver);
  } else {
    addAuthFunctionsToDefaultResolver(
      graphqlApi,
      logicalId,
      resolver,
      policyStoreId,
      verifiedPermissionsDataSource,
      projectMemberDataSource
    );
  }
}

function addAuthFunctionsToDefaultResolver(
  graphqlApi: IGraphqlApi,
  logicalId: string,
  resolver: CfnResolver,
  policyStoreId: string,
  verifiedPermissionsDataSource: HttpDataSource,
  projectMemberDataSource: DynamoDbDataSource
) {
  return addAuthFunctionsToResolver(
    graphqlApi,
    logicalId,
    resolver,
    policyStoreId,
    (functions, construct) => {
      const idPrefix = logicalId.replaceAll(".", "");
      const buildResult = build(
        path.join(resolversDir, "fetchPrincipalAttrs.ts")
      );
      const fetchPrincipalAttrsId = `${idPrefix}FetchPrincipalAttrsFn`;
      const fetchPrincipalAttrs = new AppsyncFunction(
        construct,
        fetchPrincipalAttrsId,
        {
          api: graphqlApi,
          name: fetchPrincipalAttrsId,
          dataSource: projectMemberDataSource,
          runtime: FunctionRuntime.JS_1_0_0,
          code: Code.fromInline(buildResult.text),
        }
      );

      const isAuthorizedBuildResult = build(
        path.join(resolversDir, "isAuthorized.ts")
      );
      const IsAuthorizedFunctionId = `${idPrefix}IsAuthorizedFn`;
      const IsAuthorizedFunction = new AppsyncFunction(
        construct,
        IsAuthorizedFunctionId,
        {
          api: graphqlApi,
          name: IsAuthorizedFunctionId,
          dataSource: verifiedPermissionsDataSource,
          runtime: FunctionRuntime.JS_1_0_0,
          code: Code.fromInline(isAuthorizedBuildResult.text),
        }
      );

      const preFunctions = functions.slice(0, -1);
      const dataFunction = functions[functions.length - 1];
      return [
        ...preFunctions,
        fetchPrincipalAttrs.functionId,
        dataFunction,
        IsAuthorizedFunction.functionId,
      ];
    }
  );
}

function addAuthFunctionsToResolver(
  graphqlApi: IGraphqlApi,
  logicalId: string,
  resolver: CfnResolver,
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
  resolver.responseMappingTemplate = responseMappingTemplate;
  resolver.requestMappingTemplate = `$util.qr($ctx.stash.put("policyStoreId", "${policyStoreId}"))
${resolver.requestMappingTemplate}`;
}

function addAuthFunctionsToGetResolver(
  graphqlApi: IGraphqlApi,
  logicalId: string,
  resolver: CfnResolver,
  policyStoreId: string,
  verifiedPermissionsDataSource: HttpDataSource,
  projectMemberDataSource: DynamoDbDataSource
) {
  return addAuthFunctionsToResolver(
    graphqlApi,
    logicalId,
    resolver,
    policyStoreId,
    (functions, construct) => {
      const idPrefix = logicalId.replaceAll(".", "");
      const id = `${idPrefix}FetchPrincipalAttrsFn`;
      const buildResult = build(
        path.join(resolversDir, "fetchPrincipalAttrs.ts")
      );
      const fetchPrincipalAttrs = new AppsyncFunction(construct, id, {
        api: graphqlApi,
        name: id,
        dataSource: projectMemberDataSource,
        runtime: FunctionRuntime.JS_1_0_0,
        code: Code.fromInline(buildResult.text),
      });

      const isAuthorizedBuildResult = build(
        path.join(resolversDir, "isAuthorized.ts")
      );
      const IsAuthorizedFunctionId = `${idPrefix}IsAuthorizedFn`;
      const IsAuthorizedFunction = new AppsyncFunction(
        construct,
        IsAuthorizedFunctionId,
        {
          api: graphqlApi,
          name: IsAuthorizedFunctionId,
          dataSource: verifiedPermissionsDataSource,
          runtime: FunctionRuntime.JS_1_0_0,
          code: Code.fromInline(isAuthorizedBuildResult.text),
        }
      );

      const [auth, postAuth, data] = functions;

      return [
        auth,
        postAuth,
        fetchPrincipalAttrs.functionId,
        data,
        IsAuthorizedFunction.functionId,
      ];
    }
  );
}

function isPipelineConfigProperty(
  pipelineConfig: IResolvable | CfnResolver.PipelineConfigProperty | undefined
): pipelineConfig is CfnResolver.PipelineConfigProperty {
  return !!pipelineConfig && "functions" in pipelineConfig;
}
