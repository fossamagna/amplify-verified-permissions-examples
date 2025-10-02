import path from "node:path";
import {
  AppsyncFunction,
  BaseDataSource,
  CfnDataSource,
  CfnFunctionConfiguration,
  Code,
  FunctionRuntime,
  IGraphqlApi,
} from "aws-cdk-lib/aws-appsync";
import { Construct } from "constructs";
import { build } from "../build";
import {
  getCfnDataSourceToCreateFromResolverLogicalId,
  getCfnDataSourceToUpdateAndDeleteFromResolverLogicalId,
} from "./getCfnDataSourceFromResolverLogicalId";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const resolversDir = path.join(__dirname, "..", "resolvers");

export function createFetchPrincipalAttrsFunction(
  construct: Construct,
  idPrefix: string,
  graphqlApi: IGraphqlApi,
  projectMemberDataSource: BaseDataSource
) {
  const id = `${idPrefix}FetchPrincipalAttrsFn`;
  const buildResult = build(path.join(resolversDir, "fetchPrincipalAttrs.ts"));
  const fetchPrincipalAttrs = new AppsyncFunction(construct, id, {
    api: graphqlApi,
    name: id,
    dataSource: projectMemberDataSource,
    runtime: FunctionRuntime.JS_1_0_0,
    code: Code.fromInline(buildResult.text),
  });
  return fetchPrincipalAttrs;
}

export function createIsAuthorizedFunction(
  construct: Construct,
  idPrefix: string,
  graphqlApi: IGraphqlApi,
  verifiedPermissionsDataSource: BaseDataSource
) {
  const isAuthorizedBuildResult = build(
    path.join(resolversDir, "isAuthorized.ts")
  );
  const isAuthorizedFunctionId = `${idPrefix}IsAuthorizedFn`;
  const isAuthorizedFunction = new AppsyncFunction(
    construct,
    isAuthorizedFunctionId,
    {
      api: graphqlApi,
      name: isAuthorizedFunctionId,
      dataSource: verifiedPermissionsDataSource,
      runtime: FunctionRuntime.JS_1_0_0,
      code: Code.fromInline(isAuthorizedBuildResult.text),
    }
  );
  return isAuthorizedFunction;
}

export function createBatchIsAuthorizedFunction(
  construct: Construct,
  idPrefix: string,
  graphqlApi: IGraphqlApi,
  verifiedPermissionsDataSource: BaseDataSource
) {
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
  return batchIsAuthorizedFunction;
}

export function createGetItemFunction(
  construct: Construct,
  logicalId: string,
  graphqlApi: IGraphqlApi,
  cfnDataSources: Record<string, CfnDataSource>
) {
  const dataSource = getCfnDataSourceToUpdateAndDeleteFromResolverLogicalId(
    logicalId,
    cfnDataSources
  );
  const idPrefix = createIdPrefix(logicalId);
  const getItemBuildResult = build(path.join(resolversDir, "getItem.ts"));
  const getItemFunctionId = `${idPrefix}GetItemFn`;
  const getItemFunction = new CfnFunctionConfiguration(
    construct,
    getItemFunctionId,
    {
      apiId: graphqlApi.apiId,
      name: getItemFunctionId,
      functionVersion: "2018-05-29",
      dataSourceName: dataSource.name,
      runtime: {
        name: "APPSYNC_JS",
        runtimeVersion: "1.0.0",
      },
      code: getItemBuildResult.text,
    }
  );
  return getItemFunction;
}

export function createGetParentFunction(
  construct: Construct,
  logicalId: string,
  graphqlApi: IGraphqlApi,
  cfnDataSources: Record<string, CfnDataSource>
) {
  const dataSource = getCfnDataSourceToCreateFromResolverLogicalId(
    logicalId,
    cfnDataSources
  );
  const idPrefix = createIdPrefix(logicalId);
  const getParentBuildResult = build(path.join(resolversDir, "getParent.ts"));
  const getParentFunctionId = `${idPrefix}GetParentFn`;
  const getParentFunction = new CfnFunctionConfiguration(
    construct,
    getParentFunctionId,
    {
      apiId: graphqlApi.apiId,
      name: getParentFunctionId,
      functionVersion: "2018-05-29",
      dataSourceName: dataSource ? dataSource.name : "NONE_DS",
      runtime: {
        name: "APPSYNC_JS",
        runtimeVersion: "1.0.0",
      },
      code: getParentBuildResult.text,
    }
  );
  return getParentFunction;
}

export function createGetItemFromModelFilterFunction(
  construct: Construct,
  idPrefix: string,
  graphqlApi: IGraphqlApi,
  dataSource: BaseDataSource,
) {
  const getItemBuildResult = build(
    path.join(resolversDir, "getItemFromModelFilter.ts"),
  );
  const id = `${idPrefix}GetItemFromModelFilterFn`;
  const fetchPrincipalAttrs = new AppsyncFunction(construct, id, {
    api: graphqlApi,
    name: id,
    dataSource,
    runtime: FunctionRuntime.JS_1_0_0,
    code: Code.fromInline(getItemBuildResult.text),
  });
  return fetchPrincipalAttrs;
}

function createIdPrefix(logicalId: string) {
  return logicalId.replaceAll(".", "");
}
