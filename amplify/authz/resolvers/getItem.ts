import type { Context } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx: Context) {
  if (util.authType() !== "User Pool Authorization") {
    runtime.earlyReturn({});
  }
  const key =
    ctx.stash?.metadata?.modelObjectKey
      ? ctx.stash.metadata.modelObjectKey
      : { id: ctx.args.input.id };

  return ddb.get({
    key
  });
}

export function response(ctx: Context) {
  const { error, result } = ctx;
  if (error) {
    return util.appendError(error.message, error.type, result);
  }
  return ctx.result;
}
