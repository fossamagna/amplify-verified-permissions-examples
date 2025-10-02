import type { Context } from "@aws-appsync/utils";
import * as ddb from "@aws-appsync/utils/dynamodb";

type FilterFieldNamesAndType = { filterFieldName: string; resourceType: string }

// modelName -> FilterFieldNamesAndType[]
const subscriptions: Record<string, FilterFieldNamesAndType[]> = {
  Project: [
    { filterFieldName: "id", resourceType: "Project" },
  ],
  Folder: [
    { filterFieldName: "id", resourceType: "Folder" },
    { filterFieldName: "projectId", resourceType: "Project" },
  ],
  File: [
    { filterFieldName: "id", resourceType: "File" },
    { filterFieldName: "folderId", resourceType: "Folder" },
    { filterFieldName: "projectId", resourceType: "Project" },
  ],
};

function extractModelName(fieldName: string) {
  if (fieldName.startsWith("onCreate")) {
    return fieldName.replace("onCreate", "");
  } else if (fieldName.startsWith("onUpdate")) {
    return fieldName.replace("onUpdate", "");
  } else if (fieldName.startsWith("onDelete")) {
    return fieldName.replace("onDelete", "");
  }
  return null;
}

export function request(ctx: Context) {
  if (util.authType() !== "User Pool Authorization") {
    runtime.earlyReturn(ctx.prev.result);
  }
  const fieldName = ctx.stash.fieldName;
  const modelName = extractModelName(fieldName);
  if (!modelName) {
    util.error(`Invalid subscription field name: ${fieldName}`);
  }

  const filterFieldNamesAndTypes = subscriptions[modelName];
  if (!filterFieldNamesAndTypes) {
    util.error(
      `No subscription configuration for field: ${ctx.stash.fieldName}`,
    );
  }

  const typeAndId = decideResourceFromModelFilter(
    filterFieldNamesAndTypes,
    ctx.args.filter,
  );
  if (!typeAndId) {
    util.error(`No matching field found in subscription request: ${fieldName}`);
  }

  const { type, id } = typeAndId;
  const tableName = getTableName(ctx, type);
  if (!tableName) {
    util.error(`Table not found for type: ${type}`);
  }
  return ddb.batchGet({
    tables: {
      [tableName]: {
        keys: [{ id }],
      },
    },
  });
}

function getTableName(ctx: Context, modelName: string) {
  return ctx.stash.tables[modelName];
}

function isFilter(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === "object" && obj !== null;
}

function decideResourceFromModelFilter(
  filterFieldNamesAndTypes: FilterFieldNamesAndType[],
  filter: { [key: string]: unknown } | undefined | null,
) {
  for (const { filterFieldName, resourceType } of filterFieldNamesAndTypes) {
    if (isFilter(filter) && typeof filter[filterFieldName] === "object") {
      const modelFilter = filter[filterFieldName] as Record<string, unknown>;
      if (
        Object.hasOwn(modelFilter, "eq") &&
        typeof modelFilter.eq === "string"
      ) {
        return {
          type: resourceType,
          id: modelFilter.eq as string,
        };
      }
    }
  }
  return null;
}

export function response(ctx: Context) {
  const { error, result } = ctx;
  if (error) {
    return util.error(error.message, error.type);
  }
  const tableName = Object.keys(result.data)[0];
  if (!tableName) {
    return util.error("No table found in response", "InternalError");
  }
  const items = result.data[tableName];
  return items && items.length > 0 ? items[0] : null;
}
