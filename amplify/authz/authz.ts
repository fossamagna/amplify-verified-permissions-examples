import { AmplifyGraphqlApi } from "@aws-amplify/graphql-api-construct";
import {
  DynamoDbDataSource,
  HttpDataSource,
} from "aws-cdk-lib/aws-appsync";
import { Stack } from "aws-cdk-lib";
import { PolicyStore } from "./policy-store";
import { PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { addAuthFunctionsToResolvers } from "./functions/index";

export function authz(
  data: Omit<AmplifyGraphqlApi, "getResourceAccessAcceptor">
) {
  const policyStore = new PolicyStore(data, "PolicyStore");
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

  Object.keys(data.resources.cfnResources.cfnDataSources).forEach((name) => {
    console.log(`DataSource for ${name}`);
  });
  Object.entries(data.resources.cfnResources.cfnResolvers).forEach(
    ([name, resolver]) => {
      console.log(`Resolver for ${name}`);
      addAuthFunctionsToResolvers(
        data.resources.graphqlApi,
        name,
        resolver,
        data.resources.cfnResources.cfnDataSources,
        policyStore.policyStore.attrPolicyStoreId,
        verifiedPermissionsDataSource,
        projectMemberDataSource
      );
    }
  );
}
