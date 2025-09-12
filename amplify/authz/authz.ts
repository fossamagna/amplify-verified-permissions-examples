import path from "node:path";
import esbuild from "esbuild";
import { AmplifyGraphqlApi } from "@aws-amplify/graphql-api-construct";
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
import { PolicyStore } from "./policy-store";
import { PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const responseMappingTemplate = `#if($ctx.stash.userAttributes)
  #set($ctx.prev.result.userAttributes = $ctx.stash.userAttributes)
#end
$util.toJson($ctx.prev.result)
`;

export function authz(
  data: Omit<AmplifyGraphqlApi, "getResourceAccessAcceptor">
) {
  // Object.entries(data.resources.tables).forEach(([name, dataSource]) => {
  //   console.log(`DataSource for ${name}`);
  //   //addAuthFunctionsToDataSources(backend.data.resources.graphqlApi, name, dataSource);
  // });

  const policyStore = new PolicyStore(data, "PolicyStore");

  // const projectMemberDataSource = backend.data.addDynamoDbDataSource("ProjectMember", backend.data.resources.tables.ProjectMember);
  const projectMemberTable = data.resources.tables.ProjectMember;
  const projectMemberDataSource = new DynamoDbDataSource(
    Stack.of(projectMemberTable),
    "ProjectMemberDS",
    {
      api: data.resources.graphqlApi,
      name: "ProjectMemberDS",
      table: projectMemberTable,
      readOnlyAccess: true,
    }
  );

  const serviceRole = new Role(
    Stack.of(data.resources.graphqlApi),
    "VerifiedPermissionsRole",
    {
      assumedBy: new ServicePrincipal("appsync.amazonaws.com"),
      description: "Role for AppSync to call Verified Permissions",
    }
  );
  serviceRole.addToPolicy(
    new PolicyStatement({
      actions: [
        "verifiedpermissions:BatchIsAuthorized",
        "verifiedpermissions:IsAuthorized",
      ],
      resources: ["*"],
    })
  );

  const verifiedPermissionsDataSource = new HttpDataSource(
    Stack.of(data.resources.graphqlApi),
    "VerifiedPermissionsDS",
    {
      api: data.resources.graphqlApi,
      name: "VerifiedPermissionsDS",
      endpoint: `https://verifiedpermissions.${Stack.of(data.resources.graphqlApi).region}.amazonaws.com`,
      serviceRole,
      authorizationConfig: {
        signingRegion: Stack.of(data.resources.graphqlApi).region,
        signingServiceName: "verifiedpermissions",
      },
    }
  );

  Object.entries(data.resources.cfnResources.cfnResolvers).forEach(
    ([name, resolver]) => {
      console.log(`Resolver for ${name}`);
      addAuthFunctionsToResolvers(data.resources.graphqlApi, name, resolver);
    }
  );

  function addAuthFunctionsToResolvers(
    graphqlApi: IGraphqlApi,
    logicalId: string,
    resolver: CfnResolver
  ) {
    if (logicalId.startsWith("Query.get")) {
      addAuthFunctionsToGetResolver(graphqlApi, logicalId, resolver);
    } else if (logicalId.startsWith("Query.list")) {
      //addAuthFunctionsToListResolver(graphqlApi, logicalId, resolver);
    } else if (logicalId.startsWith("Mutation.")) {
      //addAuthFunctionsToMutationResolver(graphqlApi, logicalId, resolver);
    } else if (logicalId.startsWith("Subscription.")) {
      //addAuthFunctionsToSubscriptionResolver(graphqlApi, logicalId, resolver);
    } else {
      addAuthFunctionsToDefaultResolver(graphqlApi, logicalId, resolver);
    }
  }

  function addAuthFunctionsToResolver(
    graphqlApi: IGraphqlApi,
    logicalId: string,
    resolver: CfnResolver,
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
    resolver.requestMappingTemplate = `$util.qr($ctx.stash.put("policyStoreId", "${policyStore.policyStore.attrPolicyStoreId}"))
${resolver.requestMappingTemplate}`;
  }

  function addAuthFunctionsToDefaultResolver(
    graphqlApi: IGraphqlApi,
    logicalId: string,
    resolver: CfnResolver
  ) {
    return addAuthFunctionsToResolver(
      graphqlApi,
      logicalId,
      resolver,
      (functions, construct) => {
        const idPrefix = logicalId.replaceAll(".", "");
        const buildResult = build(
          path.join(__dirname, "resolvers", "fetchPrincipalAttrs.ts")
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
          path.join(__dirname, "resolvers", "isAuthorized.ts")
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

  function addAuthFunctionsToGetResolver(
    graphqlApi: IGraphqlApi,
    logicalId: string,
    resolver: CfnResolver
  ) {
    return addAuthFunctionsToResolver(
      graphqlApi,
      logicalId,
      resolver,
      (functions, construct) => {
        const idPrefix = logicalId.replaceAll(".", "");
        const id = `${idPrefix}FetchPrincipalAttrsFn`;
        const buildResult = build(
          path.join(__dirname, "resolvers", "fetchPrincipalAttrs.ts")
        );
        const fetchPrincipalAttrs = new AppsyncFunction(construct, id, {
          api: graphqlApi,
          name: id,
          dataSource: projectMemberDataSource,
          runtime: FunctionRuntime.JS_1_0_0,
          code: Code.fromInline(buildResult.text),
        });

        const isAuthorizedBuildResult = build(
          path.join(__dirname, "resolvers", "isAuthorized.ts")
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
}

const DEF_RESOLVER_CODE = `
export function request(){ return {} }
export function response(ctx){ return ctx.prev.result}
`.trim();

const TS_CONFIG =
  `{ "compilerOptions": { "target": "es2021", "module": "Node16", "noEmit": true, "moduleResolution": "node" } }`.trim();

function build(key: string) {
  const result = esbuild.buildSync({
    bundle: true,
    write: false,
    outdir: path.dirname(key),
    // outbase: path.dirname(fn.key),
    entryPoints: [key],
    format: "esm",
    platform: "node",
    target: "node16",
    sourcemap: "inline",
    sourcesContent: false,
    tsconfigRaw: TS_CONFIG,
    external: ["@aws-appsync/utils"],
  });
  if (result.errors.length) {
    throw new Error("Could not build" + key + ": " + result.errors.join("\n"));
  }
  // fs.writeFileSync(result.outputFiles[0].path, result.outputFiles[0].text);
  return result.outputFiles[0];
}
