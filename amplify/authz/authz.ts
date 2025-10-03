import { AmplifyGraphqlApi } from "@aws-amplify/graphql-api-construct";
import { DynamoDbDataSource, HttpDataSource } from "aws-cdk-lib/aws-appsync";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Stack } from "aws-cdk-lib";
import { PolicyStore } from "./policy-store";
import { PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { addAuthFunctionsToResolvers } from "./functions/index";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { StartingPosition } from "aws-cdk-lib/aws-lambda";

import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function authz(
  data: Omit<AmplifyGraphqlApi, "getResourceAccessAcceptor">
) {
  const dataStack = Stack.of(data);

  const memberTable = new Table(dataStack, "MemberTable", {
    partitionKey: { name: "userId", type: AttributeType.STRING },
    sortKey: { name: "roleAndModel", type: AttributeType.STRING },
  });

  const memberFunction = new NodejsFunction(dataStack, "MemberFunction", {
    entry: path.join(__dirname, "syncMember", "handler.ts"),
    environment: {
      MEMBER_TABLE_NAME: memberTable.tableName,
    },
  });
  memberTable.grantReadWriteData(memberFunction);

  console.log(Object.keys(data.resources.tables));

  memberFunction.addEventSource(
    new DynamoEventSource(data.resources.tables.ProjectMember, {
      startingPosition: StartingPosition.LATEST,
    })
  );
  memberFunction.addEventSource(
    new DynamoEventSource(data.resources.tables.FolderMember, {
      startingPosition: StartingPosition.LATEST,
    })
  );

  const memberDataSource = new DynamoDbDataSource(
    Stack.of(memberTable),
    "MemberTableDS",
    {
      api: data.resources.graphqlApi,
      table: memberTable,
      readOnlyAccess: true,
    }
  );

  const policyStore = new PolicyStore(data, "PolicyStore");

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

  // Object.keys(data.resources.cfnResources.cfnDataSources).forEach((name) => {
  //   console.log(`DataSource for ${name}`);
  // });
  Object.entries(data.resources.cfnResources.cfnResolvers).forEach(
    ([name, resolver]) => {
      // console.log(`Resolver for ${name}`);
      addAuthFunctionsToResolvers(
        data.resources.graphqlApi,
        name,
        isListResolver(name),
        resolver,
        data.resources.cfnResources.cfnDataSources,
        data.resources.tables,
        policyStore.policyStore.attrPolicyStoreId,
        verifiedPermissionsDataSource,
        memberDataSource
      );
    }
  );
}

function isListResolver(logicalId: string): boolean {
  return [
    "Project.folders",
    "Project.files",
    "Project.members",
    "Folder.files",
    "Folder.members",
  ].includes(logicalId);
}
