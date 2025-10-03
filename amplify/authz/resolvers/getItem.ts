import type { Context } from '@aws-appsync/utils';

export function request(ctx: Context) {
  if (util.authType() !== "User Pool Authorization") {
    runtime.earlyReturn(ctx.prev.result);
  }

  return {
    operation : "GetItem",
    key : ctx.stash?.metadata?.modelObjectKey
      ? ctx.stash.metadata.modelObjectKey
      : util.dynamodb.toMapValues({ id: ctx.args.input.id }),
    consistentRead : true
  }
}

export function response(ctx: Context) {
  const { error, result } = ctx;
  if (error) {
    return util.appendError(error.message, error.type, result);
  }
  return ctx.result;
}
