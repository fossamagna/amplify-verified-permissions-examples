import type { Context } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx: Context) {
  if (util.authType() !== "User Pool Authorization") {
    runtime.earlyReturn({});
  }
  const modelName = ctx.stash.fieldName.replace("create", "");
  if (modelName === "Project") {
    runtime.earlyReturn({
      __typename: "App",
      id: "app",
    });
  } else if (modelName === "Folder") {
    return ddb.get({
      key: {
        id: ctx.args.input.projectId,
      }
    });
  } else if (modelName === "File") {
    return ddb.get({
      key: {
        id: ctx.args.input.folderId,
      }
    });
  } else if (modelName === "ProjectMember") {
    return ddb.get({
      key: {
        id: ctx.args.input.projectId,
      }
    });
  }
  return util.appendError(`Unsupported model: ${modelName}`, "NotSupported");
}

export function response(ctx: Context) {
  const { error, result } = ctx;
  if (error) {
    return util.appendError(error.message, error.type, result);
  }
  return ctx.result;
}
