import type { Context } from "@aws-appsync/utils";
import type {
  BatchIsAuthorizedOutput,
} from "./verified-permissions/types";
import { createBatchIsAuthorizedRequest } from "./verified-permissions/createIsAuthorizedRequest";

export function request(ctx: Context) {
  if (util.authType() !== "User Pool Authorization") {
    runtime.earlyReturn({});
  }
  const requestBody = createBatchIsAuthorizedRequest(ctx);
  return {
    version: "2018-05-29",
    method: "POST",
    resourcePath: "/",
    params: {
      headers: {
        "Content-Type": "application/x-amz-json-1.0",
        Accept: "application/x-amz-json-1.0",
        "Content-Encoding": "amz-1.0",
        "X-Amz-Target": "VerifiedPermissions.BatchIsAuthorized",
      },
      body: JSON.stringify(requestBody),
    },
  };
}

export function response(ctx: Context) {
  const { error, result, stash } = ctx;
  console.log("BatchIsAuthorized response", JSON.stringify(result));
  if (error) {
    return util.appendError(error.message, error.type, result);
  }
  if (result.statusCode !== 200) {
    return util.appendError(
      "Failed to authorize",
      "AuthorizationError",
      result
    );
  }
  const output = JSON.parse(result.body) as BatchIsAuthorizedOutput;
  const items = ctx.prev.result.items as Array<unknown>;
  const allowedItems = items.filter((_: unknown, index: number) => output.results[index].decision === "ALLOW");
  const errorItems = output.results.filter(result => result.errors && result.errors.length > 0);
  
  errorItems.forEach(errorItem => {
    errorItem.errors.forEach(err => {
      util.appendError(
        "Failed to authorize",
        "AuthorizationError",
        err
      );
    });
  });
  return {...ctx.prev.result, items: allowedItems};
}

