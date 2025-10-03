import * as fs from "node:fs";
import * as path from "node:path";
import { Construct } from "constructs";
import * as verifiedpermissions from 'aws-cdk-lib/aws-verifiedpermissions';
import { CfnPolicy } from "aws-cdk-lib/aws-verifiedpermissions";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export class PolicyStore extends Construct {

  readonly policyStore: verifiedpermissions.CfnPolicyStore;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.policyStore = new verifiedpermissions.CfnPolicyStore(this, "PolicyStore", {
      validationSettings: {
        mode: "STRICT"
      },
      // the properties below are optional
      description: "Policy Store for Amplify Verified Permissions",
      schema: {
        cedarJson: fs.readFileSync(path.join(__dirname, "verified-permissions-schema.json"), "utf-8")
      }
    });

    new CfnPolicy(this, "OwnerPolicy", {
      policyStoreId: this.policyStore.attrPolicyStoreId,
      definition: {
        static: {
          statement: fs.readFileSync(path.join(__dirname, "policies", "owner.cedar"), "utf-8"),
          description: "Grants owners full access to their projects"
        }
      }
    });

    new CfnPolicy(this, "ContributorPolicy", {
      policyStoreId: this.policyStore.attrPolicyStoreId,
      definition: {
        static: {
          statement: fs.readFileSync(path.join(__dirname, "policies", "contributor.cedar"), "utf-8"),
          description: "Grants contributors write access (except delete) to their projects"
        }
      }
    });

    new CfnPolicy(this, "ViewerPolicy", {
      policyStoreId: this.policyStore.attrPolicyStoreId,
      definition: {
        static: {
          statement: fs.readFileSync(path.join(__dirname, "policies", "viewer.cedar"), "utf-8"),
          description: "Grants viewers read-only access to their projects"
        }
      }
    });
  }
}