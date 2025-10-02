import type { AppSyncIdentityCognito, Context } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

type ProjectMember = {
  userId: string; // PK
  projectId: string; // SK
  role: string;
};

export function request(ctx: Context) {
  if (util.authType() !== "User Pool Authorization") {
    runtime.earlyReturn(ctx.prev.result);
  }
  if (ctx.source?.userAttributes) {
    ctx.stash.userAttributes = ctx.source.userAttributes;
    runtime.earlyReturn(ctx.prev.result);
  }
  const identity = ctx.identity as AppSyncIdentityCognito;
  const userId = identity.claims.sub;
  return ddb.query<ProjectMember>({
    query: {
      userId: { eq: userId },
    },
  })
}
export function response(ctx: Context) {
  const { error, result } = ctx;
  if (error) {
    return util.appendError(error.message, error.type, result);
  }
  ctx.stash.userAttributes = { projectMembers: result.items };
  return ctx.result;
}
