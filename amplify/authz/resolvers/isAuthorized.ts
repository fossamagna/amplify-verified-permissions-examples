import type { Context } from "@aws-appsync/utils";
import type {
  IsAuthorizedResponse,
} from "./verified-permissions/types";
import { createIsAuthorizedRequest } from "./verified-permissions/createIsAuthorizedRequest";

export function request(ctx: Context) {
  if (util.authType() !== "User Pool Authorization") {
    runtime.earlyReturn({});
  }
  const requestBody = createIsAuthorizedRequest(ctx);
  return {
    version: "2018-05-29",
    method: "POST",
    resourcePath: "/",
    params: {
      headers: {
        "Content-Type": "application/x-amz-json-1.0",
        Accept: "application/x-amz-json-1.0",
        "Content-Encoding": "amz-1.0",
        "X-Amz-Target": "VerifiedPermissions.IsAuthorized",
      },
      body: JSON.stringify(requestBody),
    },
  };
}

export function response(ctx: Context) {
  const { error, result, stash } = ctx;
  console.log("IsAuthorized response", JSON.stringify(result));
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
  const isAuthorizedResponse = JSON.parse(result.body) as IsAuthorizedResponse;
  if (isAuthorizedResponse.errors && isAuthorizedResponse.errors.length > 0) {
    return util.appendError(
      isAuthorizedResponse.errors[0].errorDescription,
      "AuthorizationError",
      result
    );
  }
  if (isAuthorizedResponse.decision === "ALLOW") {
    return ctx.prev.result;
  } else if (isAuthorizedResponse.decision === "DENY") {
    return util.appendError("Not authorized", "Unauthorized", result);
  }
  return util.appendError("Failed to authorize", "AuthorizationError", result);
}

